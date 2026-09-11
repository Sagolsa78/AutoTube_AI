import logging
from typing import Any, Dict
from backend.jobs.executor import JobExecutor, JobExecutionHandle
from backend.models.models import JobStatus
from backend.db.database import AsyncSessionLocal
from backend.models.models import Job

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
            
            job.status = JobStatus.queued
            job.payload = payload
            await session.commit()
            
            log.info(f"Job {job_id} queued for local execution")
            return JobExecutionHandle(job_id=job_id)

    async def cancel(self, job_id: str) -> None:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if job and job.status in [JobStatus.queued, JobStatus.running, JobStatus.dispatched]:
                job.status = JobStatus.cancelled
                await session.commit()
                log.info(f"Job {job_id} cancelled")

    async def status(self, job_id: str) -> JobStatus:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            return JobStatus(job.status)
