import logging
from typing import Optional

from sqlalchemy import select

from backend.db.database import AsyncSessionLocal
from backend.models.models import Asset
from engine.visuals.fetcher import async_download_clip, async_search_clips

log = logging.getLogger(__name__)


class VisualRouter:
    """
    Routes visual generation/fetching based on the scene's preferred mode.
    Supported modes: STOCK, GENERATED_IMAGE, GENERATED_VIDEO, MOTION_GRAPHIC, SOURCE_FOOTAGE.
    """

    def __init__(
        self, visual_dir: str, user_id: str = "default-user", strategy: str = "auto"
    ):
        self.visual_dir = visual_dir
        self.user_id = user_id
        self.strategy = strategy

    async def resolve_asset(
        self,
        scene_data: dict,
        idea_topic: str = "",
        used_source_ids: set = None,
        orientation: str = "portrait",
    ) -> Optional[str]:
        """
        Resolves an asset path for the given scene data.
        Returns the local absolute path to the asset, or None if it failed.
        """
        if used_source_ids is None:
            used_source_ids = set()

        mode = scene_data.get("preferred_visual_mode", "AUTO")
        scene_num = scene_data.get("scene_number", 1)
        intent = scene_data.get("visual_intent", "")
        motion_req = scene_data.get("camera_motion", "")
        continuity = scene_data.get("continuity_group", None)

        if self.strategy == "auto" or mode == "AUTO":
            # Real Intelligence Logic
            # E.g. Action/motion implies AI_VIDEO or STOCK
            # Character continuity implies AI_IMAGE or AI_VIDEO
            # Abstract concepts imply AI_IMAGE or STOCK

            # Simple scoring placeholder representing the real intelligence layer
            score_video = 80 if motion_req else 40
            score_image = 90 if continuity else 60
            score_stock = 70

            if score_video > score_image and score_video > score_stock:
                mode = "GENERATED_VIDEO"
            elif score_image > score_stock:
                mode = "GENERATED_IMAGE"
            else:
                mode = "STOCK"

        # Handle manual user overrides
        if scene_data.get("preferred_visual_mode") in [
            "STOCK",
            "GENERATED_IMAGE",
            "GENERATED_VIDEO",
            "USER_ASSET",
        ]:
            mode = scene_data.get("preferred_visual_mode")

        log.info(
            f"VisualRouter: intelligently resolving scene {scene_num} using mode {mode} "
            f"(Intent: {intent}, Motion: {motion_req}, Continuity: {continuity})"
        )

        if mode == "STOCK":
            # Attempt stock, if fails, fallback to AI B-Roll
            res = await self._resolve_stock(
                scene_data, idea_topic, used_source_ids, orientation=orientation
            )
            if res:
                return res
            log.warning("STOCK failed, falling back to AI B-Roll (Dynamic AI Video).")

            from engine.visuals.fallback_broll import generate_fallback_broll

            prompt = (
                scene_data.get("visual_intent")
                or scene_data.get("visual_description")
                or idea_topic
                or "beautiful scenery"
            )
            fallback_res = await generate_fallback_broll(prompt, self.visual_dir)
            if fallback_res:
                # Store the fallback asset in DB
                async with AsyncSessionLocal() as db:
                    new_asset = Asset(
                        user_id=self.user_id,
                        asset_type="video_clip",
                        source="ai_fallback",
                        path=fallback_res,
                        asset_metadata={"prompt": prompt},
                    )
                    db.add(new_asset)
                    await db.flush()
                    scene_data["asset_id"] = new_asset.id
                    await db.commit()
                return fallback_res

            log.warning("AI B-Roll fallback failed, falling back to GENERATED_IMAGE.")
            return await self._resolve_generated_image(scene_data, idea_topic)
        elif mode == "COVERR":
            # Attempt Coverr specifically, fallback to normal STOCK if it fails
            res = await self._resolve_stock(
                scene_data,
                idea_topic,
                used_source_ids,
                provider_override="coverr",
                orientation=orientation,
            )
            if res:
                return res
            log.warning("COVERR failed, falling back to STOCK.")
            return await self._resolve_stock(
                scene_data, idea_topic, used_source_ids, orientation=orientation
            )
        elif mode == "GENERATED_IMAGE":
            result = await self._resolve_generated_image(scene_data, idea_topic)
            if result:
                return result
            log.warning("GENERATED_IMAGE failed, falling back to STOCK.")
            return await self._resolve_stock(
                scene_data, idea_topic, used_source_ids, orientation=orientation
            )
        elif mode == "GENERATED_VIDEO":
            result = await self._resolve_generated_video(scene_data, idea_topic)
            if result:
                return result
            log.warning("GENERATED_VIDEO failed, falling back to STOCK.")
            return await self._resolve_stock(scene_data, idea_topic, used_source_ids)
        elif mode in ["MOTION_GRAPHIC", "SOURCE_FOOTAGE"]:
            log.warning(
                f"Mode {mode} not fully implemented yet. Falling back to STOCK."
            )
            return await self._resolve_stock(scene_data, idea_topic, used_source_ids)
        elif mode == "AUTO":
            # 1. Existing suitable source footage (omitted, SOURCE_FOOTAGE not fully implemented)
            # 2. Suitable stock
            res = await self._resolve_stock(scene_data, idea_topic, used_source_ids)
            if res:
                return res

            # 3. Generated image
            log.info("AUTO: STOCK failed, trying GENERATED_IMAGE.")
            res = await self._resolve_generated_image(scene_data, idea_topic)
            if res:
                return res

            # 4. Generated video
            log.info("AUTO: GENERATED_IMAGE failed, trying GENERATED_VIDEO.")
            res = await self._resolve_generated_video(scene_data, idea_topic)
            if res:
                return res

            log.warning("AUTO mode failed to resolve any visual.")
            return None
        else:
            log.error(f"Unknown visual mode: {mode}")
            # Do NOT fall back safely for unknown modes, fail safely.
            return None

    async def _resolve_generated_image(
        self, scene_data: dict, idea_topic: str
    ) -> Optional[str]:
        from integrations.providers.visuals.comfyui_provider import ComfyUIProvider

        client = ComfyUIProvider()
        if not client.is_available():
            return None

        prompt = (
            scene_data.get("generation_prompt")
            or scene_data.get("visual_intent")
            or scene_data.get("visual_description")
            or idea_topic
            or "beautiful scenery"
        )
        try:
            local_path = await client.generate_image(prompt, self.visual_dir)
            if local_path:
                async with AsyncSessionLocal() as db:
                    new_asset = Asset(
                        user_id=self.user_id,
                        asset_type="image",
                        source="comfyui",
                        path=local_path,
                        asset_metadata={"prompt": prompt},
                    )
                    db.add(new_asset)
                    await db.flush()
                    scene_data["asset_id"] = new_asset.id
                    await db.commit()
            return local_path
        except Exception as e:
            log.error(f"Image generation failed: {e}")
            return None

    async def _resolve_generated_video(
        self, scene_data: dict, idea_topic: str
    ) -> Optional[str]:
        from integrations.providers.visuals.comfyui_provider import ComfyUIProvider

        client = ComfyUIProvider()
        if not client.is_available():
            return None

        prompt = (
            scene_data.get("generation_prompt")
            or scene_data.get("visual_intent")
            or scene_data.get("visual_description")
            or idea_topic
            or "beautiful scenery"
        )
        try:
            local_path = await client.generate_video(prompt, self.visual_dir)
            if local_path:
                async with AsyncSessionLocal() as db:
                    new_asset = Asset(
                        user_id=self.user_id,
                        asset_type="video_clip",
                        source="comfyui_wan22",
                        path=local_path,
                        asset_metadata={"prompt": prompt},
                    )
                    db.add(new_asset)
                    await db.flush()
                    scene_data["asset_id"] = new_asset.id
                    await db.commit()
            return local_path
        except Exception as e:
            log.error(f"Video generation failed: {e}")
            return None

    async def _resolve_stock(
        self,
        scene_data: dict,
        idea_topic: str,
        used_source_ids: set,
        provider_override: str = None,
        orientation: str = "portrait",
    ) -> Optional[str]:
        """Resolves stock footage for the scene."""
        query = (
            scene_data.get("stock_query")
            or scene_data.get("visual_intent")
            or scene_data.get("visual_description")
            or idea_topic
            or "nature"
        )

        try:
            async with AsyncSessionLocal() as db:
                # Fetch more results to allow for deduplication and intelligence matching
                search_results = await async_search_clips(
                    query,
                    count=15,
                    provider_override=provider_override,
                    orientation=orientation,
                )
                if not search_results:
                    log.warning(f"No stock results found for query: {query}")
                    return None

                from engine.visuals.intelligence import AssetIntelligenceEngine

                # Rank candidates
                ranked_candidates = await AssetIntelligenceEngine.rank_candidates(
                    candidates=search_results,
                    user_id=self.user_id,
                    scene_intent=scene_data.get("visual_intent", query),
                    db=db,
                    min_duration=3.0,  # Could be derived from scene duration in the future
                    orientation=orientation,
                )

                clip_meta = (
                    ranked_candidates[0] if ranked_candidates else search_results[0]
                )

                # -- Visual QA Stage --
                qa_passed = await AssetIntelligenceEngine.validate_candidate(
                    candidate=clip_meta,
                    scene_intent=scene_data.get("visual_intent", query),
                    user_id=self.user_id,
                    db=db,
                )
                if not qa_passed:
                    log.warning(f"QA rejected the stock candidate for query: {query}")
                    return None

                source_id = str(clip_meta["source_asset_id"])
                used_source_ids.add(source_id)

                # Re-check inside the active DB session
                existing_q = select(Asset).where(
                    Asset.source == clip_meta["source"],
                    Asset.source_asset_id == source_id,
                    Asset.user_id == self.user_id,
                )
                existing_res = await db.execute(existing_q)
                existing_asset = existing_res.scalars().first()

                import os

                if (
                    existing_asset
                    and existing_asset.path
                    and os.path.exists(existing_asset.path)
                ):
                    # Cache hit! Also update the scene_data with the ID for later saves
                    scene_data["asset_id"] = existing_asset.id
                    return existing_asset.path

                # Download needed
                local_path = await async_download_clip(
                    clip_meta["download_url"], self.visual_dir, clip_meta["source"]
                )

                if existing_asset:
                    existing_asset.path = local_path
                    scene_data["asset_id"] = existing_asset.id
                else:
                    new_asset = Asset(
                        user_id=self.user_id,
                        script_id=None,
                        source_asset_id=source_id,
                        asset_type="video_clip",
                        source=clip_meta["source"],
                        path=local_path,
                        url=clip_meta["url"],
                        thumbnail_url=clip_meta["thumbnail_url"],
                        license=clip_meta["license"],
                        asset_metadata=clip_meta["asset_metadata"],
                    )
                    db.add(new_asset)
                    await db.flush()
                    scene_data["asset_id"] = new_asset.id

                await db.commit()
                return local_path

        except Exception as e:
            log.warning(
                f"Stock fetching failed for scene {scene_data.get('scene_number')}: {e}"
            )
            return None
