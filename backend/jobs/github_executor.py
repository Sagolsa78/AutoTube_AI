"""GitHub Actions executor for AutoTube render jobs.

The Render/FastAPI control plane creates the canonical Job row first, then this
executor dispatches the v2 worker workflow. The GitHub runner's GITHUB_TOKEN is
NOT available to the Render service; Render must provide a PAT/GitHub App token
with repository Actions: write permission.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from backend.core.config import settings
from backend.db.database import AsyncSessionLocal
from backend.jobs.executor import JobExecutor, JobExecutionHandle
from backend.models.models import Job, JobStatus

log = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
ACCEPTED_DISPATCH_STATUSES = {200, 201, 202, 204}


def _token() -> str:
    token = (settings.GITHUB_TOKEN or "").strip()
    if not token:
        raise RuntimeError(
            "Missing GITHUB_TOKEN. Configure a GitHub PAT or GitHub App token "
            "on the deployed API with repository Actions: write permission."
        )
    return token


def _repo() -> str:
    repo = (settings.GITHUB_REPO or settings.GITHUB_REPOSITORY or "").strip()
    if not repo or "/" not in repo:
        raise RuntimeError("GITHUB_REPO must look like owner/repository")
    return repo


def _workflow() -> str:
    return (getattr(settings, "GITHUB_WORKFLOW_FILE", None) or "video-worker.yml").strip()


def _ref() -> str:
    return (getattr(settings, "WORKER_GIT_REF", None) or "v2").strip()


async def dispatch_render_job(job_id: str, *, ref: str | None = None) -> dict[str, Any]:
    """Trigger the GitHub Actions render workflow for one DB Job."""
    if not job_id:
        raise ValueError("job_id is required")

    repo = _repo()
    workflow = _workflow()
    target_ref = (ref or _ref()).strip()
    if not target_ref:
        raise RuntimeError("WORKER_GIT_REF cannot be empty")

    url = f"{GITHUB_API}/repos/{repo}/actions/workflows/{workflow}/dispatches"
    headers = {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "AutoTube_AI/backend",
    }
    payload = {"ref": target_ref, "inputs": {"job_id": str(job_id)}}

    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code not in ACCEPTED_DISPATCH_STATUSES:
        body = response.text[:4000]
        raise RuntimeError(
            f"GitHub workflow dispatch failed: HTTP {response.status_code}; {body}"
        )

    details: dict[str, Any] = {}
    if response.content:
        try:
            details = response.json()
        except ValueError:
            details = {}

    return {
        "ok": True,
        "repo": repo,
        "workflow": workflow,
        "ref": target_ref,
        "job_id": str(job_id),
        "status_code": response.status_code,
        **details,
    }


class GitHubActionsJobExecutor(JobExecutor):
    """JobExecutor implementation backed by GitHub Actions workflow_dispatch."""

    async def submit(self, job_id: str, payload: Dict[str, Any]) -> JobExecutionHandle:
        # Verify the canonical DB job exists before dispatching. This prevents
        # a GitHub runner from starting against a job that the worker cannot see.
        async with AsyncSessionLocal() as db:
            job = await db.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            if job.status in {JobStatus.completed.value, JobStatus.cancelled.value}:
                raise ValueError(f"Job {job_id} is already {job.status}")

        audit = await dispatch_render_job(job_id)

        async with AsyncSessionLocal() as db:
            job = await db.get(Job, job_id)
            if not job:
                raise RuntimeError(
                    f"GitHub workflow was accepted but Job {job_id} disappeared from the database"
                )
            job.status = JobStatus.dispatched.value
            job.worker_id = "github_actions"
            job.worker_type = "github_actions"
            job.result = audit
            await db.commit()

        log.info(
            "Dispatched job %s to GitHub Actions: repo=%s workflow=%s ref=%s status=%s",
            job_id,
            audit["repo"],
            audit["workflow"],
            audit["ref"],
            audit["status_code"],
        )
        return JobExecutionHandle(job_id=job_id)

    async def cancel(self, job_id: str) -> None:
        async with AsyncSessionLocal() as db:
            job = await db.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")

            run_id = (job.result or {}).get("workflow_run_id")
            if run_id:
                repo = _repo()
                url = f"{GITHUB_API}/repos/{repo}/actions/runs/{run_id}/cancel"
                headers = {
                    "Authorization": f"Bearer {_token()}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2026-03-10",
                    "User-Agent": "AutoTube_AI/backend",
                }
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(url, headers=headers)
                if response.status_code not in {202, 409}:
                    raise RuntimeError(
                        f"GitHub run cancellation failed: HTTP {response.status_code}; {response.text[:2000]}"
                    )

            job.status = JobStatus.cancelled.value
            await db.commit()

    async def status(self, job_id: str) -> JobStatus:
        async with AsyncSessionLocal() as db:
            job = await db.get(Job, job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            return JobStatus(job.status)
