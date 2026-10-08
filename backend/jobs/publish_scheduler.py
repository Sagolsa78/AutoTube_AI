"""
Publish Scheduler — checks for scheduled publications and publishes them when due.
Runs as a background task within the FastAPI lifespan, checking every 60 seconds.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.db.database import AsyncSessionLocal
from backend.models.models import (
    PlatformConnection,
    Publication,
    Video,
    VideoStatus,
    utc_now,
)

log = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None


from backend.core.redis_client import get_redis


async def _check_scheduled_publications():
    """Publishes videos whose scheduled_at has passed."""
    redis_client = await get_redis()
    if redis_client:
        lock = await redis_client.set("lock:publish_scheduler", "1", nx=True, ex=60)
        if not lock:
            return

    try:
        async with AsyncSessionLocal() as db:
            now = utc_now()

            # Crash recovery: reset stuck publishing jobs (older than 15 mins)
            from datetime import timedelta

            timeout_threshold = now - timedelta(minutes=15)
            q_stuck = (
                select(Publication)
                .where(Publication.schedule_status == "publishing")
                .where(Publication.updated_at < timeout_threshold)
            )
            stuck_res = await db.execute(q_stuck)
            for stuck_pub in stuck_res.scalars():
                log.warning(
                    f"Recovering stuck publication {stuck_pub.id} from publishing state."
                )
                stuck_pub.schedule_status = "scheduled"
            await db.commit()

            # Use SKIP LOCKED to prevent multiple workers from claiming the same publication
            q = (
                select(Publication)
                .where(Publication.schedule_status == "scheduled")
                .where(Publication.scheduled_at <= now)
                .with_for_update(skip_locked=True)
            )
            result = await db.execute(q)
            due_pubs = result.scalars().all()

            if not due_pubs:
                return

            log.info(
                "Found %d scheduled publication(s) due for publishing.", len(due_pubs)
            )

            # Mark as 'publishing' first to prevent duplicate execution if worker crashes
            for pub in due_pubs:
                pub.schedule_status = "publishing"
                pub.last_attempt_at = now
            await db.commit()

            for pub in due_pubs:
                try:
                    video = await db.get(Video, pub.video_id)
                    if not video:
                        pub.schedule_status = "failed"
                        pub.last_error = "Video not found"
                        await db.commit()
                        continue

                    from backend.services.publisher import get_publisher

                    connection = (
                        await db.get(PlatformConnection, pub.platform_connection_id)
                        if pub.platform_connection_id
                        else None
                    )
                    if not connection:
                        q_conn = select(PlatformConnection).where(
                            PlatformConnection.user_id == pub.user_id,
                            PlatformConnection.platform == pub.platform,
                        )
                        conn_res = await db.execute(q_conn)
                        connection = conn_res.scalars().first()

                    if not connection:
                        raise ValueError(
                            f"No active {pub.platform} connection found for user."
                        )

                    publisher = get_publisher(pub.platform)

                    if not await publisher.validate_connection(connection):
                        raise ValueError(
                            f"Connection for {pub.platform} is invalid or expired."
                        )

                    remote_id = await publisher.publish(
                        publication=pub,
                        connection=connection,
                        video_path=video.path,
                    )
                    url = (
                        f"https://youtu.be/{remote_id}"
                        if remote_id and pub.platform == "youtube"
                        else None
                    )

                    pub.remote_media_id = remote_id
                    pub.url = url
                    pub.status = "live"
                    pub.schedule_status = "published"
                    pub.published_at = utc_now()
                    pub.privacy_status = "public"

                    video.status = VideoStatus.uploaded
                    log.info(
                        "Scheduled publish succeeded for video %s on platform: %s",
                        pub.video_id,
                        pub.platform,
                    )
                    await db.commit()

                except Exception as pub_exc:
                    log.error(
                        "Scheduled publish failed for video %s: %s",
                        pub.video_id,
                        pub_exc,
                    )
                    pub.attempts += 1
                    pub.last_error = str(pub_exc)

                    if pub.attempts >= 3:
                        pub.schedule_status = "failed"
                        pub.status = f"schedule_failed: {pub_exc}"
                    else:
                        # Retryable, put back to scheduled
                        pub.schedule_status = "scheduled"

                    await db.commit()

    except Exception as exc:
        log.exception("Publish scheduler check failed: %s", exc)
    finally:
        if redis_client:
            await redis_client.delete("lock:publish_scheduler")


async def _scheduler_loop():
    """Runs the scheduler check every 60 seconds."""
    log.info("Publish scheduler started.")
    while True:
        try:
            await _check_scheduled_publications()
        except Exception as exc:
            log.exception("Scheduler loop error: %s", exc)
        await asyncio.sleep(60)


def start_publish_scheduler():
    """Start the scheduler as a background asyncio task."""
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop())
        log.info("Publish scheduler background task created.")


def stop_publish_scheduler():
    """Cancel the scheduler task."""
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        log.info("Publish scheduler stopped.")
