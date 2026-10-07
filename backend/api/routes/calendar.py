from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth.dependencies import get_current_user
from backend.db.database import get_db
from backend.models.models import Idea, Publication, Script, User, Video, VideoStatus

router = APIRouter()


class ScheduledItemOut(BaseModel):
    id: str
    video_id: str
    title: str
    platform: str
    scheduled_at: datetime
    schedule_status: str
    thumbnail_url: Optional[str] = None


@router.get("/", response_model=List[ScheduledItemOut])
async def get_calendar(
    start_date: datetime,
    end_date: datetime,
    channel_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch calendar entries for a given date range."""
    q = (
        select(Publication, Video)
        .join(Video, Publication.video_id == Video.id)
        .where(Publication.user_id == user.id)
        .where(Publication.scheduled_at >= start_date)
        .where(Publication.scheduled_at <= end_date)
    )

    if channel_id:
        q = (
            q.join(Script, Video.script_id == Script.id)
            .join(Idea, Script.idea_id == Idea.id)
            .where(Idea.channel_id == channel_id)
        )

    res = await db.execute(q)

    results = []
    for pub, video in res.all():
        results.append(
            ScheduledItemOut(
                id=pub.id,
                video_id=pub.video_id,
                title=pub.title or video.selected_title or "Untitled",
                platform=pub.platform,
                scheduled_at=pub.scheduled_at,
                schedule_status=pub.schedule_status,
                thumbnail_url=None,  # Would populate from render artifacts later
            )
        )
    return results


class ScheduleRequest(BaseModel):
    video_id: str
    platforms: List[str]
    scheduled_at: datetime


@router.post("/schedule", response_model=List[ScheduledItemOut])
async def schedule_video(
    req: ScheduleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually schedule a video to multiple platforms."""
    video = await db.get(Video, req.video_id)
    if not video or video.user_id != user.id:
        raise HTTPException(404, "Video not found")

    if video.status != VideoStatus.ready:
        raise HTTPException(
            400,
            f"Video must be in 'ready' state to schedule. Current state: {video.status}",
        )

    new_pubs = []
    for platform in req.platforms:
        pub = Publication(
            user_id=user.id,
            video_id=video.id,
            platform=platform,
            title=video.selected_title,
            description=video.description,
            hashtags=video.hashtags,
            privacy_status="private",
            scheduled_at=req.scheduled_at,
            schedule_status="scheduled",
        )
        db.add(pub)
        new_pubs.append(pub)

    video.status = VideoStatus.approved
    await db.commit()

    for pub in new_pubs:
        await db.refresh(pub)

    return [
        ScheduledItemOut(
            id=pub.id,
            video_id=pub.video_id,
            title=pub.title or video.selected_title or "Untitled",
            platform=pub.platform,
            scheduled_at=pub.scheduled_at,
            schedule_status=pub.schedule_status,
        )
        for pub in new_pubs
    ]
