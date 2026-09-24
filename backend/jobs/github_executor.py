"""
GitHub Actions Job Executor.
Dispatches render jobs to the GitHub Actions video-worker.yml workflow
via the GitHub REST API (workflow_dispatch).
"""

import logging
from typing import Any, Dict

import httpx

from backend.core.config import settings
from backend.db.database import AsyncSessionLocal
from backend.jobs.executor import JobExecutionHandle, JobExecutor
from backend.models.models import Job, JobStatus

log = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubActionsJobExecutor(JobExecutor):
    """
    Dispatches jobs by triggering a GitHub Actions workflow_dispatch event.
    The worker runs as a GitHub Actions job and calls back to update status.
    """

    def __init__(self):
        self.token = settings.GITHUB_TOKEN
        self.repo = settings.GITHUB_REPO
        self.ref = settings.WORKER_GIT_REF or "main"

        if not self.token:
            log.warning("[GitHubExecutor] GITHUB_TOKEN not set — dispatches will fail.")

    async def submit(self, job_id: str, payload: Dict[str, Any]) -> JobExecutionHandle:
        """Trigger the video-worker.yml workflow with the job_id input."""
        if not self.token:
            raise RuntimeError(
                "GITHUB_TOKEN is not configured. Cannot dispatch to GitHub Actions."
            )

        url = (
            f"{GITHUB_API_BASE}/repos/{self.repo}"
            f"/actions/workflows/video-worker.yml/dispatches"
        )
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        body = {
            "ref": self.ref,
            "inputs": {"job_id": job_id},
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, headers=headers, json=body)

        if resp.status_code not in (204, 200):
            raise RuntimeError(
                f"GitHub Actions dispatch failed ({resp.status_code}): {resp.text}"
            )

        # Transition job to QUEUED in the database
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if job:
                job.status = JobStatus.QUEUED
                job.worker_type = "github_actions"
                await session.commit()

        log.info(
            f"[GitHubExecutor] Dispatched job {job_id} to GitHub Actions "
            f"(repo={self.repo}, ref={self.ref})"
        )
        return JobExecutionHandle(job_id=job_id)

    async def cancel(self, job_id: str) -> None:
        """
        Cancel a GitHub Actions job.
        We update the DB status; the running workflow will check status
        and exit gracefully if cancelled.
        """
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if job and job.status in [
                JobStatus.QUEUED,
                JobStatus.RUNNING,
                JobStatus.CLAIMED,
            ]:
                job.status = JobStatus.CANCELLED
                await session.commit()
                log.info(f"[GitHubExecutor] Job {job_id} marked as cancelled")

    async def status(self, job_id: str) -> JobStatus:
        """Check the job status from the database."""
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            return JobStatus(job.status)
