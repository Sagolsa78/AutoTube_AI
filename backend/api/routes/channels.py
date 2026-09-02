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

router = APIRouter()


class ChannelIn(BaseModel):
    name:     str
    niche:    str
    language: str = "en"


class ChannelOut(BaseModel):
    id:        str
    name:      str
    niche:     str
    language:  str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ChannelOut])
async def list_channels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel))
    return [_fmt(c) for c in result.scalars().all()]


@router.post("/", response_model=ChannelOut, status_code=201)
async def create_channel(body: ChannelIn, db: AsyncSession = Depends(get_db)):
    ch = Channel(name=body.name, niche=body.niche, language=body.language)
    db.add(ch)
    await db.flush()
    return _fmt(ch)


@router.get("/{channel_id}", response_model=ChannelOut)
async def get_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    ch = await db.get(Channel, channel_id)
    if not ch:
        raise HTTPException(404, "Channel not found")
    return _fmt(ch)


@router.delete("/{channel_id}", status_code=204)
async def delete_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    ch = await db.get(Channel, channel_id)
    if not ch:
        raise HTTPException(404, "Channel not found")
    await db.delete(ch)


def _fmt(c: Channel) -> dict:
    return {
        "id":         c.id,
        "name":       c.name,
        "niche":      c.niche,
        "language":   c.language,
        "created_at": str(c.created_at),
    }
