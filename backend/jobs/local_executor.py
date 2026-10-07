import logging
from typing import Any, Dict

from backend.db.database import AsyncSessionLocal
from backend.jobs.executor import JobExecutionHandle, JobExecutor
from backend.models.models import Job, JobStatus

log = logging.getLogger(__name__)


class LocalJobExecutor(JobExecutor):
    """
    Dispatches jobs to be picked up by the local standalone worker process.
    It simply ensures the job is in the 'queued' state and relies on the worker
    polling the database to pick it up.
    """

    async def submit(self, job_id: str, payload: Dict[str, Any]) -> JobExecutionHandle:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")

            job.status = JobStatus.QUEUED
            job.payload = payload
            await session.commit()

            # Push to Redis stream for local worker consumption
            import json

            from backend.core.redis_client import get_redis

            r = await get_redis()
            if r:
                stream_name = "autotube:jobs:local_pc"
                flat_payload = json.dumps(payload)
                await r.xadd(
                    stream_name,
                    {
                        "job_id": job_id,
                        "capability": job.capability,
                        "payload": flat_payload,
                    },
                )
            else:
                log.warning("Redis is unavailable, job may not be picked up by worker")

            log.info(f"Job {job_id} queued for local execution")
            return JobExecutionHandle(job_id=job_id)

    async def cancel(self, job_id: str) -> None:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if job and job.status in [
                JobStatus.QUEUED,
                JobStatus.RUNNING,
                JobStatus.CLAIMED,
            ]:
                job.status = JobStatus.CANCELLED
                await session.commit()
                log.info(f"Job {job_id} cancelled")

    async def status(self, job_id: str) -> JobStatus:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            return JobStatus(job.status)
