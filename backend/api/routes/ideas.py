"""
Ideas router — generate, list, approve/reject content ideas.
"""
from __future__ import annotations
import json
import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Idea, IdeaStatus, Channel
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)
router = APIRouter()


class IdeaOut(BaseModel):
    id:         str
    channel_id: str
    title:      str
    topic:      str
    angle:      str | None
    status:     str
    score:      float
    created_at: str

    class Config:
        from_attributes = True


class GenerateIdeasIn(BaseModel):
    channel_id: str
    count:      int = 5
    niche:      str | None = None


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
    db: AsyncSession = Depends(get_db),
):
    q = select(Idea)
    if channel_id:
        q = q.where(Idea.channel_id == channel_id)
    if status:
        q = q.where(Idea.status == status)
    result = await db.execute(q)
    return [_fmt(i) for i in result.scalars().all()]


@router.post("/generate", response_model=list[IdeaOut], status_code=201)
async def generate_ideas(body: GenerateIdeasIn, db: AsyncSession = Depends(get_db)):
    """
    Dynamically generates trending, highly interesting content ideas using the LLM.
    Ensures they are novel and not repeated.
    """
    channel = await db.get(Channel, body.channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")

    niche = body.niche or channel.niche
    
    # Optional: fetch last few approved topics to avoid repeats
    recent_q = select(Idea.topic).where(Idea.channel_id == body.channel_id).order_by(Idea.created_at.desc()).limit(15)
    recent_result = await db.execute(recent_q)
    recent_topics = [t for t in recent_result.scalars().all()]
    
    avoid_str = f"DO NOT use these recently covered topics: {', '.join(recent_topics)}" if recent_topics else ""

    prompt = f"""You are a brilliant YouTube Shorts content strategist. 
Generate {body.count} highly trending, viral, and wildly interesting topic ideas for a '{niche}' channel.
These should be things people are currently fascinated by or bizarre/mind-blowing facts that hook attention immediately.

{avoid_str}

Respond ONLY with a JSON list of strings (no markdown, no other text).
Example:
[
  "The terrifying physics of rogue waves",
  "Why your brain creates fake memories",
  "The deepest hole ever dug by humans"
]"""

    try:
        raw_response, provider = generate_with_fallback(prompt)
        topics = _extract_json_list(raw_response)
        
        # Fallback if JSON parsing fails completely
        if not topics:
            topics = [line.strip().lstrip("-*1234567890. ") for line in raw_response.split("\\n") if line.strip()][:body.count]
            if not topics:
                raise ValueError("LLM returned empty or unparseable topics.")
                
    except Exception as e:
        log.error("Idea generation failed: %s", e)
        raise HTTPException(500, f"Idea generation failed: {e}")

    created = []
    for topic in topics:
        idea = Idea(
            channel_id=body.channel_id,
            title=topic,
            topic=topic,
            angle="Viral/Trending hook",
            status=IdeaStatus.pending,
        )
        db.add(idea)
        created.append(idea)
        
    await db.flush()
    return [_fmt(i) for i in created]


@router.patch("/{idea_id}/approve", response_model=IdeaOut)
async def approve_idea(idea_id: str, db: AsyncSession = Depends(get_db)):
    idea = await db.get(Idea, idea_id)
    if not idea:
        raise HTTPException(404, "Idea not found")
    idea.status = IdeaStatus.approved
    await db.flush()
    return _fmt(idea)


@router.patch("/{idea_id}/reject", response_model=IdeaOut)
async def reject_idea(idea_id: str, db: AsyncSession = Depends(get_db)):
    idea = await db.get(Idea, idea_id)
    if not idea:
        raise HTTPException(404, "Idea not found")
    idea.status = IdeaStatus.rejected
    await db.flush()
    return _fmt(idea)


def _fmt(i: Idea) -> dict:
    return {
        "id":         i.id,
        "channel_id": i.channel_id,
        "title":      i.title,
        "topic":      i.topic,
        "angle":      i.angle,
        "status":     i.status.value if hasattr(i.status, "value") else i.status,
        "score":      i.score or 0.0,
        "created_at": str(i.created_at),
    }
