"""
Worker Daemon for AutoTube AI.
Executes RENDER capability jobs from Redis Streams.
Usage:
  python -m backend.worker.main                 # Consumes from Redis continuously
  python -m backend.worker.main --job-id <ID>   # Executes single job and exits
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
from datetime import datetime, timedelta, timezone

from backend.core.redis_client import get_redis
from backend.db.database import AsyncSessionLocal
from backend.models.models import Job, JobStatus, Video, VideoStatus
from engine.models import RenderJob

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

# Global flag for graceful shutdown
_shutdown_requested = False


def handle_shutdown(sig, frame):
    global _shutdown_requested
    log.warning(f"[Worker] Received signal {sig}. Initiating graceful shutdown...")
    _shutdown_requested = True


async def renew_lease(job_id: str):
    """Background task to renew the job lease while processing."""
    log.info(f"[Lease] Started lease renewal for job {job_id}")
    try:
        while not _shutdown_requested:
            async with AsyncSessionLocal() as db:
                try:
                    job = await db.get(Job, job_id)
                    if job and job.status == JobStatus.RUNNING:
                        now = datetime.now(timezone.utc)
                        job.heartbeat_at = now
                        job.lease_expires_at = now + timedelta(seconds=60)
                        await db.commit()
                        log.debug(f"[Lease] Renewed lease for job {job_id}")
                    else:
                        break  # Stop if job is no longer running
                except Exception as e:
                    log.warning(f"[Lease] Failed to renew lease for job {job_id}: {e}")
            await asyncio.sleep(30)
    except asyncio.CancelledError:
        log.info(f"[Lease] Lease renewal cancelled for job {job_id}")


async def execute_job(job_id: str) -> bool:
    """Executes a single job based on its capability."""
    from backend.services.asset_service import execute_asset_job
    from backend.services.rendering_service import run_job

    capability = None
    payload = {}
    video_id = None

    # Step 1: Read & Claim the Job in a short-lived DB session
    async with AsyncSessionLocal() as db:
        try:
            job_record = await db.get(Job, job_id)
            if not job_record:
                log.error(f"[Worker] Job {job_id} not found.")
                return False

            # Valid states for claiming
            if job_record.status not in [
                JobStatus.QUEUED,
                JobStatus.CLAIMED,
                JobStatus.RUNNING,
            ]:
                log.warning(
                    f"[Worker] Job {job_id} is in status {job_record.status}, not ready to run."
                )
                return False

            if job_record.status == JobStatus.QUEUED:
                job_record.transition_to(JobStatus.CLAIMED)

            job_record.transition_to(JobStatus.RUNNING)
            now = datetime.now(timezone.utc)
            job_record.started_at = now
            job_record.heartbeat_at = now
            job_record.lease_expires_at = now + timedelta(seconds=60)
            await db.commit()

            capability = job_record.capability
            payload = job_record.payload or {}
            video_id = payload.get("video_id")
        except Exception as e:
            await db.rollback()
            log.error(f"[Worker] Error claiming job {job_id}: {e}")
            return False

    # Step 2: Execute long-running render / asset pipeline
    success = False
    error_msg = None
    lease_task = asyncio.create_task(renew_lease(job_id))
    try:
        if capability == "RENDER":
            if not video_id:
                raise ValueError("No video_id in RENDER payload.")
            render_job = RenderJob(**payload)
            await run_job(video_id, render_job, job_id=job_id)

            # Check video outcome
            async with AsyncSessionLocal() as db:
                video = await db.get(Video, video_id)
                if video and video.status in (VideoStatus.ready, VideoStatus.uploaded):
                    success = True
                else:
                    success = False
                    error_msg = video.notes if video else "Render failed"
        elif capability in ["IMAGE", "VIDEO"]:
            success = await execute_asset_job(job_id)
        else:
            raise ValueError(f"Unsupported capability: {capability}")
    except Exception as e:
        log.exception(f"[Worker] Unhandled error running job {job_id}: {e}")
        success = False
        error_msg = str(e)
    finally:
        lease_task.cancel()
        try:
            await lease_task
        except asyncio.CancelledError:
            pass

    # Step 3: Update Job Status in a fresh DB session
    async with AsyncSessionLocal() as db:
        try:
            job_record = await db.get(Job, job_id)
            if job_record:
                if success:
                    job_record.transition_to(JobStatus.SUCCEEDED)
                else:
                    job_record.transition_to(JobStatus.FAILED)

                if error_msg:
                    job_record.error_message = error_msg
                job_record.completed_at = datetime.now(timezone.utc)
                await db.commit()
                log.info(
                    f"[Worker] Job {job_id} finalized with status: {job_record.status}"
                )
        except Exception as e:
            await db.rollback()
            log.error(f"[Worker] Error finalizing job {job_id}: {e}")

    return success


async def consume_redis_stream(worker_id: str, stream_name: str, group_name: str):
    """Continuously polls Redis Streams for jobs via XREADGROUP."""
    log.info(
        f"[Worker] Started Redis Stream consumer on {stream_name} (Group: {group_name})"
    )
    redis = await get_redis()
    if not redis:
        log.error("[Worker] Cannot connect to Redis. Shutting down consumer.")
        return

    # Ensure stream and group exist
    try:
        await redis.xgroup_create(
            name=stream_name, groupname=group_name, id="0", mkstream=True
        )
    except Exception as e:
        if "BUSYGROUP Consumer Group name already exists" not in str(e):
            log.warning(f"[Worker] Error creating consumer group: {e}")

    while not _shutdown_requested:
        try:
            # Block for 2 seconds waiting for new jobs (using '>' special ID)
            streams = {stream_name: ">"}
            messages = await redis.xreadgroup(
                groupname=group_name,
                consumername=worker_id,
                streams=streams,
                count=1,
                block=2000,
            )

            if messages:
                for stream, msg_list in messages:
                    for msg_id, msg_data in msg_list:
                        job_id = msg_data.get("job_id")
                        if job_id:
                            log.info(
                                f"[Worker] Claimed job {job_id} from stream {stream_name}"
                            )
                            await execute_job(job_id)
                        # Always ACK so we don't process it repeatedly unless we explicitly XCLAIM
                        await redis.xack(stream_name, group_name, msg_id)
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.error(f"[Worker] Redis consumption error: {e}")
            await asyncio.sleep(5)

    log.info("[Worker] Consumer loop exited gracefully.")


async def heartbeat_loop(worker_id: str):
    """Periodically sends heartbeat to Control Plane via HTTP."""
    import httpx

    api_base = os.getenv("AUTOTUBE_API_URL", "http://127.0.0.1:8000/api").rstrip("/")
    url = f"{api_base}/jobs/worker/heartbeat"
    payload = {
        "worker_id": worker_id,
        "status": "AVAILABLE",
        "capabilities": ["RENDER", "IMAGE", "VIDEO", "TTS", "LLM"],
    }
    log.info(f"[Worker] Started heartbeat loop targeting {url}.")
    while not _shutdown_requested:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(url, json=payload)
        except Exception as e:
            log.debug(f"[Worker] Heartbeat ping failed: {e}")
        await asyncio.sleep(10)
    log.info("[Worker] Heartbeat loop exited gracefully.")


async def watchdog():
    """Identifies and fails stale jobs that have been running for too long in DB."""
    log.info("[Worker] Started watchdog loop.")
    while not _shutdown_requested:
        try:
            async with AsyncSessionLocal() as db:
                from sqlalchemy import select

                now = datetime.now(timezone.utc)
                q = select(Job).where(
                    Job.status.in_([JobStatus.CLAIMED, JobStatus.RUNNING]),
                    Job.lease_expires_at < now,
                )
                res = await db.execute(q)
                stale_jobs = res.scalars().all()
                for job in stale_jobs:
                    log.warning(
                        f"[Watchdog] Failing stale job {job.id} (lease expired at {job.lease_expires_at})"
                    )
                    job.transition_to(JobStatus.FAILED)
                    job.error_message = "Job lease expired (worker disconnected)."
                    job.completed_at = datetime.now(timezone.utc)

                    if job.capability == "RENDER":
                        payload = job.payload or {}
                        video_id = payload.get("video_id")
                        if video_id:
                            video = await db.get(Video, video_id)
                            if video and video.status == VideoStatus.rendering:
                                video.status = VideoStatus.failed
                                video.render_stage = "failed"
                                video.notes = job.error_message
                await db.commit()
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.error(f"[Watchdog] Error: {e}")
        await asyncio.sleep(60)


def main():
    parser = argparse.ArgumentParser(description="AutoTube AI Worker")
    parser.add_argument("--job-id", type=str, help="Run a specific job ID and exit")
    parser.add_argument(
        "--worker-id",
        type=str,
        default="local_pc",
        help="Identifier for this worker instance",
    )
    args = parser.parse_args()

    # Register graceful shutdown signals
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    if args.job_id:
        log.info(f"[Worker] Single-shot execution for Job ID: {args.job_id}")
        success = asyncio.run(execute_job(args.job_id))
        sys.exit(0 if success else 1)
    else:
        stream_name = f"autotube:jobs:{args.worker_id}"
        group_name = "autotube_workers"

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        tasks = [
            loop.create_task(watchdog()),
            loop.create_task(heartbeat_loop(args.worker_id)),
            loop.create_task(
                consume_redis_stream(args.worker_id, stream_name, group_name)
            ),
        ]

        # Run until the shutdown flag is set (handled in the while loops of the tasks)
        loop.run_until_complete(asyncio.gather(*tasks))


if __name__ == "__main__":
    main()
