import asyncio
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.models.models import Asset, User
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)


class AssetIntelligenceEngine:
    """
    Intelligently scores and selects the best asset from a list of candidates.
    Pipeline:
    1. Duration & Resolution Matching
    2. Repetition Penalty (queries DB for past usage)
    3. Diversity Scoring
    4. Semantic Matching (LLM selection)
    """

    @classmethod
    async def rank_candidates(
        cls,
        candidates: list[dict],
        user_id: str,
        scene_intent: str,
        db: AsyncSession,
        min_duration: float = 3.0,
        orientation: str = "portrait",
    ) -> list[dict]:
        if not candidates:
            return []

        scored_candidates = []
        source_ids = [str(c["source_asset_id"]) for c in candidates]

        # 1. Fetch used assets to apply repetition penalty
        used_assets = []
        if source_ids:
            q = select(Asset.source_asset_id).where(
                Asset.user_id == user_id, Asset.source_asset_id.in_(source_ids)
            )
            res = await db.execute(q)
            used_assets = set(res.scalars().all())

        # Track photographers for diversity penalty
        seen_photographers = set()

        for c in candidates:
            score = 100.0
            source_id = str(c["source_asset_id"])

            # Repetition penalty (heavy)
            if source_id in used_assets:
                score -= 80.0

            # Duration matching
            duration = float(c.get("duration") or 0.0)
            if duration > 0 and duration < min_duration:
                score -= 40.0

            # Resolution matching
            width = float(c.get("width") or 0.0)
            height = float(c.get("height") or 0.0)
            if width > 0 and height > 0:
                if orientation == "portrait" and width > height:
                    # Penalize landscape for shorts
                    score -= 20.0
                elif orientation == "landscape" and height > width:
                    # Penalize portrait for long form
                    score -= 20.0

                if min(width, height) < 720:  # Low resolution
                    score -= 15.0

            # Diversity penalty
            photog = c.get("photographer")
            if photog and photog in seen_photographers:
                score -= 10.0
            if photog:
                seen_photographers.add(photog)

            c["_intelligence_score"] = score
            scored_candidates.append(c)

        # Sort by score descending
        scored_candidates.sort(key=lambda x: x["_intelligence_score"], reverse=True)

        # Keep top 5 valid candidates for semantic matching
        top_candidates = [c for c in scored_candidates if c["_intelligence_score"] > 0][
            :5
        ]
        if not top_candidates:
            # Fallback to returning whatever scored highest if all are terrible
            return scored_candidates

        # 2. Semantic Matching via LLM
        # We present the top candidates to the LLM and ask it to pick the best ID.
        user = await db.get(User, user_id)
        preferred_prov = (
            user.preferred_ai_provider if user else settings.DEFAULT_AI_PROVIDER
        )
        preferred_mod = user.preferred_ai_model if user else settings.DEFAULT_AI_MODEL

        candidates_json = []
        for c in top_candidates:
            # Extract tags/URL string safely
            meta = c.get("asset_metadata", {})
            tags = meta.get("tags") or meta.get("url", "")
            candidates_json.append(
                {
                    "id": str(c["source_asset_id"]),
                    "description": f"Tags or URL: {tags}",
                    "duration": float(c.get("duration", 0)),
                }
            )

        prompt = f"""You are an expert video editor. You need to select the best stock footage clip for a scene.
Scene Intent: "{scene_intent}"

Available Candidates:
{json.dumps(candidates_json, indent=2)}

Select the SINGLE best candidate 'id' that semantically matches the scene intent.
Respond ONLY with a JSON object: {{"selected_id": "the-id-you-chose"}}
Do not include markdown or other text."""

        try:
            raw_response, _, _ = await asyncio.to_thread(
                generate_with_fallback,
                prompt,
                preferred_provider=preferred_prov,
                preferred_model=preferred_mod,
            )
            cleaned = raw_response.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            selected_id = data.get("selected_id")

            if selected_id:
                # Boost the selected candidate to the top
                for c in top_candidates:
                    if str(c["source_asset_id"]) == str(selected_id):
                        c["_intelligence_score"] += 1000.0
                        break

                # Re-sort after semantic boost
                top_candidates.sort(
                    key=lambda x: x["_intelligence_score"], reverse=True
                )
        except Exception as e:
            log.warning(
                f"Semantic matching failed, falling back to heuristic score. Error: {e}"
            )

        return top_candidates

    @classmethod
    async def validate_candidate(
        cls,
        candidate: dict,
        scene_intent: str,
        user_id: str,
        db: AsyncSession,
    ) -> bool:
        """
        Visual QA Stage: Validates if the selected candidate actually meets the scene intent.
        Returns True if it's a valid match, False if it should be rejected.
        """
        user = await db.get(User, user_id)
        preferred_prov = (
            user.preferred_ai_provider if user else settings.DEFAULT_AI_PROVIDER
        )
        preferred_mod = user.preferred_ai_model if user else settings.DEFAULT_AI_MODEL

        meta = candidate.get("asset_metadata", {})
        tags = meta.get("tags") or meta.get("url", "")

        prompt = f"""You are a strict Video QA Reviewer.
We need a video clip for this scene intent: "{scene_intent}"

We found a stock video with the following metadata/tags:
"{tags}"

Does this stock video genuinely match the required scene intent?
If it is completely unrelated or a bad match, you must reject it.
Respond ONLY with a JSON object: {{"approved": true}} or {{"approved": false}}
Do not include markdown or other text."""

        try:
            raw_response, _, _ = await asyncio.to_thread(
                generate_with_fallback,
                prompt,
                preferred_provider=preferred_prov,
                preferred_model=preferred_mod,
            )
            cleaned = raw_response.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            return data.get("approved", True)
        except Exception as e:
            log.warning(f"QA validation failed, defaulting to True. Error: {e}")
            return True
