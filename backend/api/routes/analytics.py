"""
Analytics router — store + retrieve per-video performance metrics.
"""
from __future__ import annotations
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Analytics, Video

router = APIRouter()


class AnalyticsIn(BaseModel):
    video_id:    str
    views:       int = 0
    likes:       int = 0
    comments:    int = 0
    shares:      int = 0
    subscribers: int = 0
    retention:   float | None = None


class AnalyticsOut(BaseModel):
    id:          str
    video_id:    str
    views:       int
    likes:       int
    comments:    int
    shares:      int
    subscribers: int
    retention:   float | None
    recorded_at: str


@router.post("/", response_model=AnalyticsOut, status_code=201)
async def record_analytics(body: AnalyticsIn, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, body.video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    row = Analytics(
        video_id    = body.video_id,
        views       = body.views,
        likes       = body.likes,
        comments    = body.comments,
        shares      = body.shares,
        subscribers = body.subscribers,
        retention   = body.retention,
        recorded_at = datetime.utcnow(),
    )
    db.add(row)
    await db.flush()
    return _fmt(row)


@router.get("/{video_id}", response_model=list[AnalyticsOut])
async def get_analytics(video_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Analytics).where(Analytics.video_id == video_id)
        .order_by(Analytics.recorded_at.desc())
    )
    return [_fmt(r) for r in result.scalars().all()]


@router.get("/summary/top-videos")
async def top_videos(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Return videos ranked by latest view count."""
    from sqlalchemy import func
    result = await db.execute(
        select(Analytics.video_id, func.max(Analytics.views).label("max_views"))
        .group_by(Analytics.video_id)
        .order_by(func.max(Analytics.views).desc())
        .limit(limit)
    )
    rows = result.all()
    return [{"video_id": r.video_id, "max_views": r.max_views} for r in rows]


def _fmt(r: Analytics) -> dict:
    return {
        "id":          r.id,
        "video_id":    r.video_id,
        "views":       r.views,
        "likes":       r.likes,
        "comments":    r.comments,
        "shares":      r.shares,
        "subscribers": r.subscribers,
        "retention":   r.retention,
        "recorded_at": str(r.recorded_at),
    }
