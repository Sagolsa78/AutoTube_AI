"""
Channels router — CRUD for YouTube channels tracked in the system.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Channel
from backend.auth.dependencies import get_current_user
from backend.models.models import User

router = APIRouter()


class ChannelCreate(BaseModel):
    name:     str
    niche:    str
    language: str = "en"
    default_cta: str | None = None
    caption_style: str | None = None
    watermark_enabled: bool | None = None
    watermark_opacity: float | None = None
    watermark_position: str | None = None
    watermark_scale: float | None = None
    default_voice_id: str | None = None
    content_tone: str | None = None
    niche_keywords: list[str] | None = None
    title_style_preference: str | None = None
    hashtag_set: list[str] | None = None
    auto_approve: bool | None = None


class ChannelUpdate(BaseModel):
    name:     str | None = None
    niche:    str | None = None
    language: str | None = None
    default_cta: str | None = None
    caption_style: str | None = None
    watermark_enabled: bool | None = None
    watermark_opacity: float | None = None
    watermark_position: str | None = None
    watermark_scale: float | None = None
    default_voice_id: str | None = None
    content_tone: str | None = None
    niche_keywords: list[str] | None = None
    title_style_preference: str | None = None
    hashtag_set: list[str] | None = None
    auto_approve: bool | None = None


class ChannelOut(BaseModel):
    id:        str
    name:      str
    niche:     str
    language:  str
    default_cta: str
    caption_style: str
    watermark_enabled: bool
    watermark_opacity: float
    watermark_position: str
    watermark_scale: float
    default_voice_id: str
    content_tone: str
    niche_keywords: list[str]
    title_style_preference: str
    hashtag_set: list[str]
    auto_approve: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ChannelOut])
async def list_channels(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    q = select(Channel).where(Channel.user_id == user.id)
    result = await db.execute(q)
    return [_fmt(c) for c in result.scalars().all()]


@router.post("/", response_model=ChannelOut, status_code=201)
async def create_channel(
    body: ChannelCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    channel_data = body.model_dump(exclude_unset=True)
    channel = Channel(
        user_id=user.id,
        **channel_data
    )
    db.add(channel)
    await db.flush()
    return _fmt(channel)


@router.get("/{channel_id}", response_model=ChannelOut)
async def get_channel(
    channel_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    channel = await db.get(Channel, channel_id)
    if not channel or channel.user_id != user.id:
        raise HTTPException(404, "Channel not found")
    return _fmt(channel)


@router.patch("/{channel_id}", response_model=ChannelOut)
async def update_channel(
    channel_id: str,
    body: ChannelUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    channel = await db.get(Channel, channel_id)
    if not channel or channel.user_id != user.id:
        raise HTTPException(404, "Channel not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(channel, field, value)
    await db.flush()
    return _fmt(channel)


@router.delete("/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    channel = await db.get(Channel, channel_id)
    if not channel or channel.user_id != user.id:
        raise HTTPException(404, "Channel not found")
    await db.delete(channel)


def _fmt(c: Channel) -> dict:
    return {
        "id":         c.id,
        "name":       c.name,
        "niche":      c.niche,
        "language":   c.language,
        "default_cta":       c.default_cta or "Follow for more!",
        "caption_style":     c.caption_style or "bold_centered",
        "watermark_enabled": c.watermark_enabled if c.watermark_enabled is not None else True,
        "watermark_opacity": c.watermark_opacity or 0.4,
        "watermark_position": c.watermark_position or "bottom_right",
        "watermark_scale":   c.watermark_scale or 0.12,
        "default_voice_id":  c.default_voice_id or "en-US-ChristopherNeural",
        "content_tone":      c.content_tone or "casual",
        "niche_keywords":    c.niche_keywords or [],
        "title_style_preference": c.title_style_preference or "curiosity",
        "hashtag_set":       c.hashtag_set or ["shorts", "viral"],
        "auto_approve":      c.auto_approve if c.auto_approve is not None else False,
        "created_at": str(c.created_at),
    }
