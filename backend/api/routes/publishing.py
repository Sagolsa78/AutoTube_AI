from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.db.database import get_db
from backend.models.models import PlatformConnection, Publication, User, Video

router = APIRouter(prefix="/api/publishing", tags=["publishing"])


class PublishRequest(BaseModel):
    video_id: str
    platforms: List[str]
    title: str
    caption: str
    hashtags: str
    scheduled_at: Optional[datetime] = None


@router.post("/compose")
async def universal_publish(
    req: PublishRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Takes a single unified payload from the Universal Publish Composer and creates
    Publication records for each requested platform.
    If scheduled_at is provided, sets them to 'pending', otherwise triggers immediate upload.
    """
    video = await db.get(Video, req.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to publish this video"
        )

    created_publications = []

    # Process each requested platform
    for platform in req.platforms:
        # Check connection exists
        result = await db.execute(
            select(PlatformConnection)
            .where(PlatformConnection.user_id == current_user.id)
            .where(PlatformConnection.platform == platform)
        )
        connection = result.scalars().first()

        if not connection:
            raise HTTPException(
                status_code=400,
                detail=f"Platform {platform} is not connected. Please connect your account first.",
            )

        # Create Publication record
        tags = [t.strip().replace("#", "") for t in req.hashtags.split() if t.strip()]

        pub = Publication(
            video_id=video.id,
            platform=platform,
            connection_id=connection.id,
            title=req.title,
            description=req.caption,
            tags=tags,
            status="pending" if req.scheduled_at else "uploading",
            scheduled_at=req.scheduled_at,
        )

        db.add(pub)
        created_publications.append(pub)

    await db.commit()

    # If not scheduled, trigger background uploads
    if not req.scheduled_at:

        async def dispatch_publish_job(pub_id: str):
            pass  # Mocked for now, would push to Arq/Celery

        for pub in created_publications:
            background_tasks.add_task(dispatch_publish_job, pub.id)

    # Also update video status if it was in 'ready' state
    if video.status in ["ready", "approved"]:
        video.status = "approved" if req.scheduled_at else "uploaded"
        await db.commit()

    return {
        "message": f"Successfully queued publishing to {len(req.platforms)} platforms",
        "publications": [p.id for p in created_publications],
    }
