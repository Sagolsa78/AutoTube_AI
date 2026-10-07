"""
Ideas router — generate, list, approve/reject content ideas.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import settings
from backend.db.database import AsyncSessionLocal, get_db
from backend.models.models import Channel, Idea, IdeaStatus, User
from engine.script.trends import fetch_trending_topics
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)
router = APIRouter()


class IdeaOut(BaseModel):
    id: str
    channel_id: str
    title: str
    topic: str
    angle: str | None
    status: str
    score: float
    notes: str | None = None
    settings: dict | None = None
    created_at: str

    class Config:
        from_attributes = True


class GenerateIdeasIn(BaseModel):
    channel_id: str
    count: int = 5
    niche: str | None = None
    provider: str | None = None
    model: str | None = None
    content_type: str = "short"
    custom_content_type: str | None = None
    custom_prompt: str | None = None
    target_audience: str | None = None
    tone: str | None = None
    format: str | None = None
    target_duration: int | None = None
    language: str | None = None


class CreateIdeaIn(BaseModel):
    topic: str
    channel_id: str | None = None
    angle: str | None = None


def _extract_json_list(raw: str) -> list:
    """Strip markdown fences and parse JSON list."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return []


@router.get("/", response_model=list[IdeaOut])
async def list_ideas(
    channel_id: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Idea).join(Channel).where(Channel.user_id == user.id)
    if channel_id:
        q = q.where(Idea.channel_id == channel_id)
    if status:
        q = q.where(Idea.status == status)
    result = await db.execute(q)
    return [_fmt(i) for i in result.scalars().all()]


@router.post("/", response_model=IdeaOut, status_code=201)
async def create_idea(
    body: CreateIdeaIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel_id = body.channel_id
    if not channel_id:
        ch = await db.scalar(select(Channel).where(Channel.user_id == user.id).limit(1))
        if not ch:
            raise HTTPException(404, "No channels found")
        channel_id = ch.id

    idea = Idea(
        user_id=user.id,
        channel_id=channel_id,
        title=body.topic,
        topic=body.topic,
        angle=body.angle or "Manual idea",
        status=IdeaStatus.pending,
        score=0.0,
    )
    db.add(idea)
    await db.commit()
    await db.refresh(idea)
    return _fmt(idea)


@router.post("/generate", response_model=list[IdeaOut], status_code=201)
async def generate_ideas(
    body: GenerateIdeasIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dynamically generates trending, highly interesting content ideas using the LLM.
    Ensures they are novel and not repeated.
    """
    channel = await db.scalar(
        select(Channel).where(Channel.id == body.channel_id, Channel.user_id == user.id)
    )
    if not channel:
        raise HTTPException(404, "Channel not found")

    niche = body.niche or channel.niche

    # Optional: fetch last few approved topics to avoid repeats
    recent_q = (
        select(Idea.topic)
        .where(Idea.channel_id == body.channel_id)
        .order_by(Idea.created_at.desc())
        .limit(15)
    )
    recent_result = await db.execute(recent_q)
    recent_topics = [t for t in recent_result.scalars().all()]

    avoid_str = (
        f"DO NOT use these recently covered topics: {', '.join(recent_topics)}"
        if recent_topics
        else ""
    )

    # Fetch trending topics using channel niche keywords
    kw_list = channel.niche_keywords or [niche]
    try:
        trending = fetch_trending_topics(kw_list)
    except Exception as e:
        log.warning("Pytrends failed: %s", e)
        trending = []

    trends_str = ""
    trend_notes = None
    if trending:
        trends_str = f"Here is what's currently trending in this space: {', '.join(trending)}\nGenerate ideas that ride these trends without copying them directly."
    else:
        trend_notes = "Trend data unavailable (fetch failed or empty)."

    # Channel specific tone & audience context
    audience_str = f"Target Audience: {getattr(channel, 'target_audience', None) or 'General internet users'}"
    tone_str = (
        f"Content Tone: {channel.content_tone.capitalize()}"
        if channel.content_tone
        else "Content Tone: Casual and engaging"
    )
    style_str = (
        f"Title Style: {channel.title_style_preference.capitalize()}"
        if channel.title_style_preference
        else "Title Style: Curiosity Gap"
    )

    prompt = f"""You are a brilliant YouTube Shorts content strategist.
Generate {body.count} highly trending, viral, and wildly interesting topic ideas for a '{niche}' channel.
These should be things people are currently fascinated by or bizarre/mind-blowing facts that hook attention immediately.

Context:
- {audience_str}
- {tone_str}
- {style_str}

{trends_str}
{avoid_str}

Respond ONLY with a JSON list of strings (no markdown, no other text).
Example:
[
  "The terrifying physics of rogue waves",
  "Why your brain creates fake memories",
  "The deepest hole ever dug by humans"
]"""

    # Release connection back to pool so it does not sit idle during LLM generation
    try:
        await db.commit()
    except Exception:
        pass

    try:
        preferred_prov = (
            body.provider or user.preferred_ai_provider or settings.DEFAULT_AI_PROVIDER
        )
        preferred_mod = (
            body.model or user.preferred_ai_model or settings.DEFAULT_AI_MODEL
        )
        raw_response, provider, cost_data = await asyncio.to_thread(
            generate_with_fallback,
            prompt,
            preferred_provider=preferred_prov,
            preferred_model=preferred_mod,
        )
        topics = _extract_json_list(raw_response)

        # Fallback if JSON parsing fails completely
        if not topics:
            topics = [
                line.strip().lstrip("-*1234567890. ")
                for line in raw_response.split("\n")
                if line.strip()
            ][: body.count]
            if not topics:
                raise ValueError("LLM returned empty or unparseable topics.")

        # Record cost
        if cost_data:
            from backend.models.models import CostEvent

            cost_event = CostEvent(
                user_id=user.id,
                channel_id=body.channel_id,
                stage="Idea Generation",
                provider=cost_data.get("provider"),
                model=cost_data.get("model"),
                tokens=cost_data.get("tokens", 0),
                estimated_cost=cost_data.get("estimated_cost", 0.0),
                operation="llm_generation",
            )
            db.add(cost_event)

    except Exception as e:
        log.error("Idea generation failed: %s", e)
        raise HTTPException(500, f"Idea generation failed: {e}")
    import random

    from engine.quality.relevance_guard import RelevanceGuard

    # Pre-fetch recent topics for relevance checking
    recent_q2 = (
        select(Idea.topic)
        .where(Idea.channel_id == body.channel_id)
        .order_by(Idea.created_at.desc())
        .limit(20)
    )
    recent_result2 = await db.execute(recent_q2)
    recent_topics_list = [t for t in recent_result2.scalars().all()]

    target_audience = getattr(channel, "target_audience", None) or "General"

    created = []
    for topic in topics:
        # Phase 15: Content Relevance Guard
        is_relevant = await asyncio.to_thread(
            RelevanceGuard.check_relevance,
            topic,
            niche,
            target_audience,
            recent_topics_list,
        )

        if not is_relevant:
            log.info(f"Relevance Guard rejected idea: {topic}")
            continue

        score = random.uniform(85.0, 99.0) if trending else random.uniform(60.0, 85.0)

        idea_settings = {
            "content_type": body.content_type,
            "custom_content_type": body.custom_content_type,
            "custom_prompt": body.custom_prompt,
            "target_audience": body.target_audience,
            "tone": body.tone,
            "format": body.format,
            "target_duration": body.target_duration,
            "language": body.language,
        }

        idea = Idea(
            user_id=user.id,
            channel_id=body.channel_id,
            title=topic,
            topic=topic,
            angle="Viral/Trending hook",
            status=IdeaStatus.pending,
            score=score,
            notes=trend_notes,
            settings=idea_settings,
        )
        db.add(idea)
        created.append(idea)

    await db.commit()
    # Format outputs from the newly persisted objects
    formatted = [_fmt(i) for i in created]
    return formatted


@router.post("/{idea_id}/discard", response_model=IdeaOut)
async def discard_idea(
    idea_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    idea = await db.scalar(
        select(Idea).where(Idea.id == idea_id, Idea.user_id == user.id)
    )
    if not idea:
        raise HTTPException(404, "Idea not found")
    channel = await db.scalar(
        select(Channel).where(Channel.id == idea.channel_id, Channel.user_id == user.id)
    )
    if not channel or channel.user_id != user.id:
        raise HTTPException(404, "Idea not found")
    if idea.status == IdeaStatus.promoted:
        raise HTTPException(
            400, "Cannot discard an idea that has already been promoted to a script."
        )
    idea.status = IdeaStatus.discarded
    await db.flush()
    return _fmt(idea)


@router.get("/recommend-next")
async def recommend_next_idea(
    channel_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 3: AI-powered content recommendation.
    Uses channel history, performance data, and exclusions to suggest
    the best next video topic.
    """
    from backend.services.content_intelligence import ContentIntelligenceService

    if not channel_id:
        # Find first channel
        ch = await db.scalar(select(Channel).where(Channel.user_id == user.id).limit(1))
        if not ch:
            raise HTTPException(404, "No channels found")
        channel_id = ch.id
    else:
        ch = await db.scalar(
            select(Channel).where(Channel.id == channel_id, Channel.user_id == user.id)
        )
        if not ch:
            raise HTTPException(404, "Channel not found")

    preferred_prov = user.preferred_ai_provider or settings.DEFAULT_AI_PROVIDER
    preferred_mod = user.preferred_ai_model or settings.DEFAULT_AI_MODEL

    result = await ContentIntelligenceService.recommend_next(
        channel_id=channel_id,
        user_id=user.id,
        db=db,
        preferred_provider=preferred_prov,
        preferred_model=preferred_mod,
    )

    if not result.get("error") and result.get("recommended_topic"):
        # Save it to the DB so it can be dismissed or approved
        idea = Idea(
            user_id=user.id,
            channel_id=channel_id,
            title=result["recommended_topic"],
            topic=result["recommended_topic"],
            angle=result.get("reason"),
            status=IdeaStatus.pending,
            score=result.get("confidence", 0.85) * 100,
            notes=f"AI Recommendation: {result.get('reason')}",
        )
        db.add(idea)
        await db.commit()
        await db.refresh(idea)
        result["idea_id"] = idea.id

    return result


class DismissIdeaIn(BaseModel):
    reason: str | None = None


@router.post("/{idea_id}/dismiss")
async def dismiss_idea(
    idea_id: str,
    body: DismissIdeaIn | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 3: Dismiss a recommended idea with optional reason.
    Stores the feedback signal for future recommendations.
    """
    idea = await db.scalar(
        select(Idea).where(Idea.id == idea_id, Idea.user_id == user.id)
    )
    if not idea:
        raise HTTPException(404, "Idea not found")

    idea.status = IdeaStatus.discarded
    if body and body.reason:
        idea.notes = (idea.notes or "") + f" [Dismissed: {body.reason}]"

    # Store dismissal signal in channel intelligence
    channel = await db.get(Channel, idea.channel_id)
    if channel and channel.user_id == user.id:
        excluded = channel.excluded_topics or []
        # If a reason is provided suggesting a topic ban, add it
        if (
            body
            and body.reason
            and body.reason.lower() in ["duplicate", "off-topic", "not interested"]
        ):
            # Record the topic so the intelligence service avoids it
            recent = channel.recent_topics or []
            recent.append(idea.topic)
            channel.recent_topics = recent[-50:]  # rolling window

    await db.commit()
    return _fmt(idea)


class ImproveIdeaIn(BaseModel):
    topic: str
    channel_id: str | None = None


@router.post("/improve")
async def improve_idea(
    body: ImproveIdeaIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Improves a rough idea/topic into a catchy YouTube Shorts hook.
    """
    prompt = f"""You are an expert YouTube Shorts producer.
Take this rough idea and improve it into a highly engaging, viral topic hook for a short-form video.
Rough idea: "{body.topic}"

Respond ONLY with the improved topic/hook string, no quotes or markdown. Keep it under 150 characters."""

    preferred_prov = user.preferred_ai_provider or settings.DEFAULT_AI_PROVIDER
    preferred_mod = user.preferred_ai_model or settings.DEFAULT_AI_MODEL
    try:
        improved, _, _ = await asyncio.to_thread(
            generate_with_fallback,
            prompt,
            preferred_provider=preferred_prov,
            preferred_model=preferred_mod,
        )
        return {"improved_topic": improved.strip(" \"'")}
    except Exception as e:
        log.error("Failed to improve idea: %s", e)
        raise HTTPException(500, f"Failed to improve idea: {e}")


def _fmt(i: Idea) -> dict:
    return {
        "id": i.id,
        "channel_id": i.channel_id,
        "title": i.title,
        "topic": i.topic,
        "angle": i.angle,
        "status": (
            i.status.value if hasattr(i.status, "value") else (i.status or "pending")
        ),
        "score": i.score or 0.0,
        "notes": i.notes,
        "settings": i.settings,
        "created_at": str(i.created_at),
    }
