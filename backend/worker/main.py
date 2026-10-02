"""
Worker Daemon for AutoTube AI.
Executes RENDER capability jobs.
Usage:
  python -m backend.worker.main                 # Polls queue continuously (Local Mode)
  python -m backend.worker.main --job-id <ID>   # Executes single job and exits (Cloud/GitHub Mode)
"""
import os
import logging
import asyncio
import argparse
import sys
from datetime import datetime, timezone, timedelta
from backend.db.database import AsyncSessionLocal
from backend.models.models import Job, JobStatus, Video, VideoStatus
from sqlalchemy import select
from engine.models import RenderJob

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


async def execute_job(job_id: str):
    """Executes a single job based on its capability."""
    from backend.services.rendering_service import run_job
    from backend.services.asset_service import execute_asset_job
    
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

            if job_record.status not in [JobStatus.queued.value, JobStatus.waiting_for_local_worker.value, JobStatus.dispatched.value, JobStatus.running.value]:
                log.warning(f"[Worker] Job {job_id} is in status {job_record.status}, not ready to run.")
                return False

            if job_record.status != JobStatus.running.value:
                job_record.status = JobStatus.running.value
                job_record.started_at = datetime.now(timezone.utc)
                await db.commit()

            capability = job_record.capability
            payload = job_record.payload or {}
            video_id = payload.get("video_id")
        except Exception as e:
            await db.rollback()
            log.error(f"[Worker] Error claiming job {job_id}: {e}")
            return False

    # Step 2: Execute long-running render / asset pipeline (no idle DB connection held)
    success = False
    error_msg = None
    try:
        if capability == "RENDER":
            if not video_id:
                raise ValueError("No video_id in RENDER payload.")
            render_job = RenderJob(**payload)
            await run_job(video_id, render_job, job_id=job_id)
            
            # Check video outcome
            async with AsyncSessionLocal() as db:
                video = await db.get(Video, video_id)
                if video and video.status == VideoStatus.ready:
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

    # Step 3: Update Job Status in a fresh DB session
    async with AsyncSessionLocal() as db:
        try:
            job_record = await db.get(Job, job_id)
            if job_record:
                job_record.status = JobStatus.completed.value if success else JobStatus.failed.value
                if error_msg:
                    job_record.error_message = error_msg
                job_record.completed_at = datetime.now(timezone.utc)
                await db.commit()
                log.info(f"[Worker] Job {job_id} finalized with status: {job_record.status}")
        except Exception as e:
            await db.rollback()
            log.error(f"[Worker] Error finalizing job {job_id}: {e}")

    return success


async def poll_jobs():
    """Continuously polls the database for queued RENDER jobs."""
    log.info("[Worker] Started durable job polling loop.")
    
    while True:
        try:
            job_id_to_run = None
            async with AsyncSessionLocal() as db:
                # Atomic job claim: find and claim in a single transaction
                try:
                    from sqlalchemy import text
                    # PostgreSQL: use SELECT FOR UPDATE SKIP LOCKED for true atomicity
                    # This prevents multiple workers from claiming the same job
                    result = await db.execute(
                        text("""
                            SELECT id FROM jobs
                            WHERE status IN ('queued', 'waiting_for_local_worker', 'dispatched')
                            AND capability IN ('RENDER', 'IMAGE', 'VIDEO')
                            ORDER BY created_at ASC
                            LIMIT 1
                            FOR UPDATE SKIP LOCKED
                        """)
                    )
                    row = result.first()
                    if row:
                        job_id_to_run = row[0]
                        # Atomically claim it
                        await db.execute(
                            text("UPDATE jobs SET status = 'running', started_at = NOW() WHERE id = :job_id"),
                            {"job_id": job_id_to_run}
                        )
                        await db.commit()
                except Exception as pg_err:
                    # SQLite doesn't support FOR UPDATE SKIP LOCKED — fall back to simple query
                    log.debug(f"[Worker] FOR UPDATE SKIP LOCKED not supported (SQLite?), falling back: {pg_err}")
                    await db.rollback()
                    q = select(Job).where(
                        Job.status.in_([JobStatus.queued.value, JobStatus.waiting_for_local_worker.value, JobStatus.dispatched.value]),
                        Job.capability.in_(["RENDER", "IMAGE", "VIDEO"])
                    ).order_by(Job.created_at.asc()).limit(1)
                    
                    res = await db.execute(q)
                    job = res.scalars().first()
                    if job:
                        job_id_to_run = job.id
                        job.status = JobStatus.running.value
                        job.started_at = datetime.now(timezone.utc)
                        await db.commit()

            if job_id_to_run:
                log.info(f"[Worker] Claimed and running job: {job_id_to_run}")
                await execute_job(job_id_to_run)
            else:
                await asyncio.sleep(5)
                
        except asyncio.CancelledError:
            log.info("[Worker] Polling loop cancelled.")
            break
        except Exception as e:
            log.error(f"[Worker] Polling loop encountered error: {e}")
            await asyncio.sleep(10)


async def watchdog():
    """Identifies and fails stale jobs that have been running for too long."""
    log.info("[Worker] Started watchdog loop.")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
                q = select(Job).where(Job.status == JobStatus.running.value, Job.started_at < cutoff)
                res = await db.execute(q)
                stale_jobs = res.scalars().all()
                for job in stale_jobs:
                    log.warning(f"[Watchdog] Failing stale job {job.id} (running since {job.started_at})")
                    job.status = JobStatus.failed.value
                    job.error_message = "Worker disappeared or job timed out (stale job recovery)."
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
            log.info("[Watchdog] Loop cancelled.")
            break
        except Exception as e:
            log.error(f"[Watchdog] Error: {e}")
        await asyncio.sleep(60)


async def heartbeat_loop():
    """Periodically sends heartbeat to Control Plane so Dashboard and Router recognize local_pc as online."""
    import httpx
    api_base = os.getenv("AUTOTUBE_API_URL", "http://127.0.0.1:8000/api").rstrip("/")
    url = f"{api_base}/jobs/worker/heartbeat"
    payload = {
        "worker_id": "local_pc",
        "status": "AVAILABLE",
        "capabilities": ["RENDER", "IMAGE", "VIDEO", "TTS", "LLM"]
    }
    log.info(f"[Worker] Started heartbeat loop targeting {url}.")
    while True:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(url, json=payload)
        except Exception as e:
            log.debug(f"[Worker] Heartbeat ping failed (control plane might be starting): {e}")
        await asyncio.sleep(10)


def main():
    parser = argparse.ArgumentParser(description="AutoTube AI Worker")
    parser.add_argument("--job-id", type=str, help="Run a specific job ID and exit")
    args = parser.parse_args()

    if args.job_id:
        log.info(f"[Worker] Single-shot execution for Job ID: {args.job_id}")
        success = asyncio.run(execute_job(args.job_id))
        sys.exit(0 if success else 1)
    else:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.create_task(watchdog())
        loop.create_task(heartbeat_loop())
        loop.run_until_complete(poll_jobs())


if __name__ == "__main__":
    main()

