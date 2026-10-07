"""
Auto-Scheduler Cron Job.
Automatically pulls ready videos and queues them up into the Publication system
based on the Channel's schedule config (buffer, timezones, platforms).
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from backend.db.database import AsyncSessionLocal
from backend.models.models import Channel, Idea, Publication, Script, Video, VideoStatus

log = logging.getLogger(__name__)

_auto_scheduler_task: asyncio.Task | None = None


async def _run_auto_scheduler():
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch all channels
            channels = (await db.execute(select(Channel))).scalars().all()
            for channel in channels:
                config = channel.schedule_config or {}
                if not config.get("auto_schedule", True):
                    continue

                tz_name = config.get("timezone", "UTC")
                try:
                    tz = ZoneInfo(tz_name)
                except Exception:
                    tz = timezone.utc

                buffer_days = config.get("buffer_days", 1)
                platforms_times = config.get("platforms", {"youtube": "18:30"})

                # 2. Find latest scheduled publication for this channel
                q_latest = (
                    select(func.max(Publication.scheduled_at))
                    .join(Video, Publication.video_id == Video.id)
                    .join(Script, Video.script_id == Script.id)
                    .join(Idea, Script.idea_id == Idea.id)
                    .where(Idea.channel_id == channel.id)
                    .where(Publication.schedule_status == "scheduled")
                )
                latest_scheduled_at = await db.scalar(q_latest)

                # Determine the target date to schedule next
                now_tz = datetime.now(tz)
                if latest_scheduled_at:
                    latest_tz = latest_scheduled_at.astimezone(tz)
                    next_date = latest_tz.date() + timedelta(days=1)
                else:
                    # If nothing scheduled, start tomorrow (or today if we passed the times?)
                    # Let's just start tomorrow to be safe
                    next_date = now_tz.date() + timedelta(days=1)

                target_datetime = datetime.combine(
                    next_date, datetime.min.time(), tzinfo=tz
                )
                target_limit = now_tz + timedelta(days=buffer_days)

                if target_datetime > target_limit:
                    # We have enough buffer
                    continue

                # 3. We need to schedule a video for `next_date`. Find an oldest ready video.
                q_ready = (
                    select(Video)
                    .join(Script, Video.script_id == Script.id)
                    .join(Idea, Script.idea_id == Idea.id)
                    .where(Idea.channel_id == channel.id)
                    .where(Video.status == VideoStatus.ready)
                    .order_by(Video.created_at.asc())
                    .with_for_update(skip_locked=True)
                    .limit(1)
                )
                ready_video = (await db.execute(q_ready)).scalars().first()

                if not ready_video:
                    log.debug(
                        f"No ready videos for channel {channel.name} to schedule."
                    )
                    continue

                log.info(
                    f"Auto-Scheduling video {ready_video.id} for channel {channel.name} on {next_date}"
                )

                for platform, time_str in platforms_times.items():
                    # Parse time (e.g., "18:30")
                    try:
                        h, m = map(int, time_str.split(":"))
                    except Exception:
                        h, m = 18, 0

                    dt = datetime.combine(
                        next_date,
                        datetime.min.time().replace(hour=h, minute=m),
                        tzinfo=tz,
                    )
                    dt_utc = dt.astimezone(timezone.utc)

                    pub = Publication(
                        user_id=channel.user_id,
                        video_id=ready_video.id,
                        platform=platform,
                        title=ready_video.selected_title,
                        description=ready_video.description,
                        hashtags=ready_video.hashtags,
                        privacy_status="private",
                        scheduled_at=dt_utc,
                        schedule_status="scheduled",
                    )
                    db.add(pub)

                # Mark video as scheduled (we keep it 'ready' but having publications means it's queued)
                # Actually, there's no explicitly 'scheduled' VideoStatus, but we could add it or just let the presence of Publications dictate it.
                # Let's change VideoStatus to 'approved' to remove it from 'ready' pool, so it's not picked up again.
                ready_video.status = VideoStatus.approved

                await db.commit()
                log.info(
                    f"Successfully scheduled video {ready_video.id} to platforms: {list(platforms_times.keys())}"
                )

        except Exception as e:
            log.exception(f"Auto-scheduler loop error: {e}")


async def _auto_scheduler_loop():
    log.info("Auto-Scheduler started.")
    while True:
        try:
            await _run_auto_scheduler()
        except Exception as e:
            log.exception("Auto-Scheduler unhandled error")
        await asyncio.sleep(60 * 5)  # Check every 5 minutes


def start_auto_scheduler():
    global _auto_scheduler_task
    if _auto_scheduler_task is None or _auto_scheduler_task.done():
        _auto_scheduler_task = asyncio.create_task(_auto_scheduler_loop())
        log.info("Auto-Scheduler background task created.")


def stop_auto_scheduler():
    global _auto_scheduler_task
    if _auto_scheduler_task and not _auto_scheduler_task.done():
        _auto_scheduler_task.cancel()
        log.info("Auto-Scheduler stopped.")
