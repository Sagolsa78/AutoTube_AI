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


class ChannelUpdate(BaseModel):
    name:     str | None = None
    niche:    str | None = None
    language: str | None = None


class ChannelOut(BaseModel):
    id:        str
    name:      str
    niche:     str
    language:  str
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
    channel = Channel(
        user_id=user.id,
        name=body.name,
        niche=body.niche,
        language=body.language
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
    if body.name is not None:
        channel.name = body.name
    if body.niche is not None:
        channel.niche = body.niche
    if body.language is not None:
        channel.language = body.language
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
        "created_at": str(c.created_at),
    }
