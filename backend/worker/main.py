"""
Worker Daemon for AutoTube AI.
Executes RENDER capability jobs.
Usage:
  python -m backend.worker.main                 # Polls queue continuously (Local Mode)
  python -m backend.worker.main --job-id <ID>   # Executes single job and exits (Cloud/GitHub Mode)
"""
import logging
import asyncio
import argparse
import sys
from datetime import datetime
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
    
    async with AsyncSessionLocal() as db:
        # Load the Job
        job_record = await db.get(Job, job_id)
        if not job_record:
            log.error(f"[Worker] Job {job_id} not found.")
            return False

        if job_record.status not in [JobStatus.queued.value, JobStatus.waiting_for_local_worker.value, JobStatus.dispatched.value]:
            log.warning(f"[Worker] Job {job_id} is in status {job_record.status}, not ready to run.")
            return False

        # Mark as running
        job_record.status = JobStatus.running.value
        job_record.started_at = datetime.utcnow()
        await db.commit()
        
        try:
            if job_record.capability == "RENDER":
                payload = job_record.payload or {}
                video_id = payload.get("video_id")
                if not video_id:
                    raise ValueError("No video_id in RENDER payload.")
                
                render_job = RenderJob(**payload)
                await run_job(video_id, render_job)
                
                # Render updates Video directly. Check status.
                await db.refresh(job_record)
                video = await db.get(Video, video_id)
                if video and video.status == VideoStatus.ready:
                    job_record.status = JobStatus.completed.value
                else:
                    job_record.status = JobStatus.failed.value
                    job_record.error_message = video.notes if video else "Unknown failure"
                    
            elif job_record.capability in ["IMAGE", "VIDEO"]:
                # Execute Asset Generation Job
                success = await execute_asset_job(job_id)
                await db.refresh(job_record)
                if not success and job_record.status != JobStatus.failed.value:
                    job_record.status = JobStatus.failed.value
                    
            else:
                raise ValueError(f"Unsupported capability: {job_record.capability}")
            

                
        except Exception as e:
            log.exception(f"[Worker] Unhandled error running job {job_id}: {e}")
            job_record.status = JobStatus.failed.value
            job_record.error_message = str(e)
            
        job_record.completed_at = datetime.utcnow()
        await db.commit()
        log.info(f"[Worker] Job {job_id} execution finished with status {job_record.status}")
        return job_record.status == JobStatus.completed.value


async def poll_jobs():
    """Continuously polls the database for queued RENDER jobs."""
    log.info("[Worker] Started durable job polling loop.")
    
    while True:
        try:
            job_id_to_run = None
            async with AsyncSessionLocal() as db:
                # Find oldest queued job
                q = select(Job).where(
                    Job.status.in_([JobStatus.queued.value, JobStatus.waiting_for_local_worker.value, JobStatus.dispatched.value]),
                    Job.capability.in_(["RENDER", "IMAGE", "VIDEO"])
                ).order_by(Job.created_at.asc()).limit(1)
                
                res = await db.execute(q)
                job = res.scalars().first()
                if job:
                    job_id_to_run = job.id

            if job_id_to_run:
                log.info(f"[Worker] Found pending job: {job_id_to_run}")
                await execute_job(job_id_to_run)
            else:
                await asyncio.sleep(5)
                
        except asyncio.CancelledError:
            log.info("[Worker] Polling loop cancelled.")
            break
        except Exception as e:
            log.error(f"[Worker] Polling loop encountered error: {e}")
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
        asyncio.run(poll_jobs())


if __name__ == "__main__":
    main()
