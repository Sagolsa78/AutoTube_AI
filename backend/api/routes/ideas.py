"""
Ideas router — generate, list, approve/reject content ideas.
"""
from __future__ import annotations
import random

import yaml
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Idea, IdeaStatus, Channel

router = APIRouter()

_NICHES_PATH = "config/niches.yaml"


def _load_niches() -> dict:
    with open(_NICHES_PATH) as f:
        return yaml.safe_load(f)


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
    count:      int = 5             # how many ideas to generate
    niche:      str | None = None   # override channel niche


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
    Pick random topics from the niche config and create Idea rows.
    No LLM call yet — this is just idea seeding from the YAML topic pool.
    """
    channel = await db.get(Channel, body.channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")

    niche = body.niche or channel.niche
    niches = _load_niches().get("niches", {})
    niche_cfg = niches.get(niche, {})
    topics = niche_cfg.get("topics", [])

    if not topics:
        raise HTTPException(400, f"No topics found for niche '{niche}'")

    sample = random.sample(topics, min(body.count, len(topics)))
    created = []
    for topic in sample:
        idea = Idea(
            channel_id=body.channel_id,
            title=topic,
            topic=topic,
            angle=niche_cfg.get("description", ""),
            status=IdeaStatus.pending,
        )
        db.add(idea)
        await db.flush()
        created.append(idea)

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
