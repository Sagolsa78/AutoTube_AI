"""GitHub Actions backed job executor.

The control plane stores the job in PostgreSQL first, then starts the
repository workflow with the job id as its only input.  The runner reads the
same job record and executes it through ``backend.worker.main``.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from backend.core.config import settings
from backend.db.database import AsyncSessionLocal
from backend.jobs.executor import JobExecutionHandle
from backend.models.models import Job, JobStatus

log = logging.getLogger(__name__)

GITHUB_API_VERSION = "2022-11-28"
WORKFLOW_FILE = "video-worker.yml"


class GitHubActionsJobExecutor:
    """Dispatch and track one-shot GitHub Actions render jobs."""

    def __init__(self) -> None:
        self.token = settings.GITHUB_TOKEN
        self.repository = (
            settings.GITHUB_REPOSITORY or settings.GITHUB_REPO
        ).strip("/")
        self.git_ref = settings.WORKER_GIT_REF or "main"

    @property
    def dispatch_url(self) -> str:
        return (
            f"https://api.github.com/repos/{self.repository}"
            f"/actions/workflows/{WORKFLOW_FILE}/dispatches"
        )

    def _validate_configuration(self) -> None:
        if not self.token:
            raise RuntimeError(
                "GITHUB_TOKEN is not configured; set a GitHub token with "
                "Actions/workflow write permission."
            )
        if not self.repository or "/" not in self.repository:
            raise RuntimeError(
                "GITHUB_REPO must be an owner/repository value, for example "
                "'Sagolsa78/AutoTube_AI'."
            )

    async def submit(
        self, job_id: str, payload: Dict[str, Any]
    ) -> JobExecutionHandle:
        """Trigger the workflow and move the persisted job to QUEUED."""
        self._validate_configuration()

        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self.token}",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
            "User-Agent": "AutoTube-AI-control-plane",
        }
        body = {
            "ref": self.git_ref,
            "inputs": {
                "job_id": str(job_id),
                "worker_git_ref": self.git_ref,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.dispatch_url,
                headers=headers,
                json=body,
            )

        if response.status_code != 204:
            try:
                details = response.json()
            except ValueError:
                details = response.text.strip()
            message = (
                details.get("message", details)
                if isinstance(details, dict)
                else details
            )
            raise RuntimeError(
                f"GitHub Actions dispatch failed ({response.status_code}): "
                f"{message}"
            )

        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found after dispatch")

            if job.status == JobStatus.CREATED:
                job.transition_to(JobStatus.QUEUED)
            elif job.status != JobStatus.QUEUED:
                log.warning(
                    "Job %s was already in %s after GitHub dispatch",
                    job_id,
                    job.status,
                )
            job.worker_type = "github_actions"
            job.worker_id = f"github-actions:{self.repository}"
            await session.commit()

        log.info(
            "Dispatched job %s to %s at ref %s",
            job_id,
            self.repository,
            self.git_ref,
        )
        return JobExecutionHandle(job_id=job_id)

    async def cancel(self, job_id: str) -> None:
        """Cancel the persisted job; the one-shot runner will observe it."""
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                return
            if job.status in (
                JobStatus.CREATED,
                JobStatus.QUEUED,
                JobStatus.CLAIMED,
                JobStatus.RUNNING,
            ):
                job.transition_to(JobStatus.CANCELLED)
                await session.commit()

    async def status(self, job_id: str) -> JobStatus:
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            return JobStatus(job.status)