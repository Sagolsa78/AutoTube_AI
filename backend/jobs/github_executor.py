import logging
import httpx
from typing import Any, Dict
from backend.jobs.executor import JobExecutor, JobExecutionHandle
from backend.models.models import JobStatus, Job
from backend.db.database import AsyncSessionLocal
from backend.core.config import settings

log = logging.getLogger(__name__)

class GitHubActionsJobExecutor(JobExecutor):
    """
    Triggers a GitHub Actions workflow_dispatch event to execute the job on a GitHub runner.
    """
    
    def __init__(self):
        self.token = settings.GITHUB_TOKEN
        self.repo = settings.GITHUB_REPO
        if not self.token or not self.repo:
            log.warning("GitHubActionsJobExecutor initialized without GITHUB_TOKEN or GITHUB_REPO")

    async def submit(self, job_id: str, payload: Dict[str, Any]) -> JobExecutionHandle:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.status = JobStatus.dispatched
            job.payload = payload
            await session.commit()
            
        if not self.token or not self.repo:
            log.error("Cannot dispatch to GitHub Actions: missing token or repo config.")
            return JobExecutionHandle(job_id=job_id)

        url = f"https://api.github.com/repos/{self.repo}/actions/workflows/video-worker.yml/dispatches"
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": f"token {self.token}"
        }
        data = {
            "ref": "main",
            "inputs": {
                "job_id": job_id
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, headers=headers, json=data)
                res.raise_for_status()
                log.info(f"Successfully dispatched job {job_id} to GitHub Actions")
        except Exception as e:
            log.error(f"Failed to dispatch to GitHub Actions: {e}")
            # Mark job as failed or fallback to local
            async with AsyncSessionLocal() as session:
                job = await session.get(Job, job_id)
                if job:
                    job.status = JobStatus.failed
                    job.error_message = f"GitHub dispatch failed: {str(e)}"
                    await session.commit()
            
        return JobExecutionHandle(job_id=job_id)

    async def cancel(self, job_id: str) -> None:
        # Complex to cancel a running GitHub action generically without knowing the run_id.
        # For now, just mark it cancelled in DB.
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if job and job.status in [JobStatus.queued, JobStatus.dispatched, JobStatus.running]:
                job.status = JobStatus.cancelled
                await session.commit()
                log.info(f"Job {job_id} marked as cancelled")

    async def status(self, job_id: str) -> JobStatus:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            return JobStatus(job.status)
