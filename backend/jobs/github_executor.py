"""Dispatch AutoTube render jobs to GitHub Actions.

The API/server must use a real GitHub token with Actions: write access.
Do not use the runner-provided GITHUB_TOKEN in the deployed API; that token
exists only inside a workflow run.
"""
from __future__ import annotations

import os
from typing import Any

import httpx


GITHUB_API = "https://api.github.com"


def _token() -> str:
    token = (
        os.getenv("GITHUB_ACTIONS_TOKEN")
        or os.getenv("GITHUB_TOKEN")
        or ""
    ).strip()
    if not token:
        raise RuntimeError(
            "Missing GITHUB_ACTIONS_TOKEN (preferred) or GITHUB_TOKEN. "
            "The deployed backend needs a PAT/GitHub App token with Actions write access."
        )
    return token


def _repo() -> str:
    repo = os.getenv("GITHUB_REPOSITORY", "Sagolsa78/AutoTube_AI").strip()
    if "/" not in repo:
        raise RuntimeError("GITHUB_REPOSITORY must look like owner/repository")
    return repo


def _workflow() -> str:
    return os.getenv("GITHUB_WORKFLOW_FILE", "video-worker.yml").strip()


def _ref() -> str:
    return os.getenv("GITHUB_WORKFLOW_REF", os.getenv("GITHUB_REF", "main")).strip()


async def dispatch_render_job(job_id: str, *, ref: str | None = None) -> dict[str, Any]:
    """Trigger one GitHub Actions render and return a small audit record.

    GitHub returns HTTP 204 when workflow_dispatch is accepted.
    """
    if not job_id:
        raise ValueError("job_id is required")

    repo = _repo()
    workflow = _workflow()
    target_ref = ref or _ref()
    url = f"{GITHUB_API}/repos/{repo}/actions/workflows/{workflow}/dispatches"
    headers = {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AutoTube_AI/backend",
    }
    payload = {"ref": target_ref, "inputs": {"job_id": str(job_id)}}

    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code != 204:
        body = response.text[:2000]
        raise RuntimeError(
            f"GitHub workflow dispatch failed: HTTP {response.status_code}; {body}"
        )

    return {
        "ok": True,
        "repo": repo,
        "workflow": workflow,
        "ref": target_ref,
        "job_id": str(job_id),
        "status_code": response.status_code,
    }
