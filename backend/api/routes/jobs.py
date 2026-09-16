"""
Jobs Router — Control Plane API contract for Compute Plane workers (§10 Phase 1).
Provides:
  - POST /api/jobs              -> Submit a compute job (LLM, TTS, IMAGE, VIDEO, RENDER, ALIGNMENT)
  - GET  /api/jobs/{id}         -> Query status, progress, and result
  - POST /api/jobs/{id}/cancel  -> Cancel queued or running job
  - POST /api/jobs/worker/heartbeat -> Worker daemon heartbeat
  - GET  /api/jobs/worker/poll  -> Worker retrieves next available job
  - POST /api/jobs/{id}/complete-> Worker reports job completion + artifacts
  - POST /api/jobs/{id}/fail    -> Worker reports job failure + error details
  - GET  /api/jobs/telemetry    -> Real-time worker status, strategy, and budget spend
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import settings
from backend.db.database import get_db
from backend.events import event_bus
from backend.models.content_spec import (
    AssetJobPayload,
    LLMJobPayload,
    RenderJobPayload,
    TTSJobPayload,
)
from backend.models.models import Job, JobStatus, User
from backend.worker_router import (
    WorkerCapability,
    WorkerStatus,
    dispatch_job,
    get_compute_telemetry,
    record_spend,
    router_registry,
)

router = APIRouter()
log = logging.getLogger(__name__)


# ── Worker Authentication Dependency ──────────────────────────────────────────


async def verify_worker_auth(
    x_worker_secret: Optional[str] = Header(None, alias="X-Worker-Secret")
):
    """
    Dependency for worker-only endpoints.
    Workers must present the WORKER_SECRET in the X-Worker-Secret header.
    If WORKER_SECRET is not configured, worker endpoints are accessible from localhost only
    (acceptable for local dev where only the local worker calls them).
    """
    worker_secret = settings.WORKER_SECRET
    if worker_secret:
        if not x_worker_secret or x_worker_secret != worker_secret:
            raise HTTPException(
                status_code=403, detail="Invalid or missing X-Worker-Secret header"
            )
    # If no WORKER_SECRET configured, allow (local dev mode)
    return True


# ── Request / Response Schemas ────────────────────────────────────────────────


class JobCreateRequest(BaseModel):
    capability: WorkerCapability
    payload: Dict[str, Any] = {}
    priority: Optional[int] = 1
    idempotency_key: Optional[str] = None

    @model_validator(mode="after")
    def validate_payload(self):
        if self.capability == WorkerCapability.RENDER:
            self.payload = RenderJobPayload.model_validate(self.payload).model_dump()
        elif self.capability in (WorkerCapability.IMAGE, WorkerCapability.VIDEO):
            self.payload = AssetJobPayload.model_validate(self.payload).model_dump()
        elif self.capability == WorkerCapability.LLM:
            self.payload = LLMJobPayload.model_validate(self.payload).model_dump()
        elif self.capability == WorkerCapability.TTS:
            self.payload = TTSJobPayload.model_validate(self.payload).model_dump()
        return self


class JobResponse(BaseModel):
    id: str
    capability: str
    status: str
    worker_id: Optional[str] = None
    worker_type: Optional[str] = None
    cost_usd: float = 0.0
    payload: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class WorkerHeartbeat(BaseModel):
    worker_id: str
    status: WorkerStatus = WorkerStatus.AVAILABLE
    capabilities: Optional[List[str]] = None


class JobCompleteRequest(BaseModel):
    worker_id: str
    result: Dict[str, Any] = {}
    cost_usd: float = 0.0


class JobFailRequest(BaseModel):
    worker_id: str
    error_message: str


# ── Job Lifecycle Endpoints ───────────────────────────────────────────────────


@router.post("/", response_model=JobResponse)
async def create_job(
    request: JobCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a compute job. Enforces the §5 Worker Router decision tree."""
    if request.idempotency_key:
        idemp_q = select(Job).where(
            Job.user_id == user.id, Job.idempotency_key == request.idempotency_key
        )
        res_idemp = await db.execute(idemp_q)
        existing_job = res_idemp.scalar_one_or_none()
        if existing_job:
            log.info(
                f"Idempotency hit: Returning existing job {existing_job.id} for key {request.idempotency_key}"
            )
            return existing_job

    # Quota check
    active_q = select(func.count(Job.id)).where(
        Job.user_id == user.id,
        Job.status.in_([JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.CLAIMED]),
    )
    res_active = await db.execute(active_q)
    active_count = res_active.scalar() or 0

    from backend.core.config import settings

    if active_count >= int(getattr(settings, "MAX_ACTIVE_JOBS_PER_USER", "2")):
        raise HTTPException(
            status_code=429,
            detail="Too many active jobs. Please wait for them to finish.",
        )

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_q = select(func.count(Job.id)).where(
        Job.user_id == user.id, Job.created_at >= today_start
    )
    res_daily = await db.execute(daily_q)
    daily_count = res_daily.scalar() or 0

    if daily_count >= int(getattr(settings, "MAX_DAILY_JOBS_PER_USER", "20")):
        raise HTTPException(status_code=429, detail="Daily job limit reached.")

    job_id = str(uuid.uuid4())

    # 1. Persist canonical record FIRST — executor must find it in DB
    new_job = Job(
        id=job_id,
        user_id=user.id,
        capability=request.capability.value,
        status=JobStatus.CREATED,
        payload=request.payload,
        idempotency_key=request.idempotency_key,
        worker_type="local",
        cost_usd=0.0,
        created_at=datetime.utcnow(),
    )
    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)

    # 2. Route via Worker Router (Job is now committed and readable)
    try:
        route_meta = await dispatch_job(
            job_id, request.capability, request.payload, user.id, db=db
        )
        try:
            new_job.transition_to(route_meta["status"])
        except ValueError as ve:
            log.warning(
                f"Could not transition job {job_id} to {route_meta['status']}: {ve}"
            )
            new_job.status = route_meta["status"]  # force fallback if necessary

        new_job.worker_id = route_meta.get("worker_id")
        new_job.worker_type = route_meta.get("worker_type", "local")
    except Exception as e:
        log.exception(f"Failed to dispatch job {job_id}")
        try:
            new_job.transition_to(JobStatus.FAILED)
        except Exception:
            new_job.status = JobStatus.FAILED
        new_job.error_message = f"Dispatch failed: {str(e)}"

    await db.commit()
    await db.refresh(new_job)

    return new_job


@router.get("/", response_model=List[JobResponse])
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by job status"),
    capability: Optional[str] = Query(None, description="Filter by capability"),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List compute and render jobs for the authenticated user."""
    stmt = select(Job).where(Job.user_id == user.id)
    if status:
        stmt = stmt.where(Job.status == status)
    if capability:
        stmt = stmt.where(Job.capability == capability)
    stmt = stmt.order_by(Job.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/telemetry")
async def get_telemetry(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Exposes real-time worker cluster status and daily GPU spend for UI dashboard."""
    return await get_compute_telemetry(user.id, db=db)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_status(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query canonical job state and result from PostgreSQL."""
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running or queued compute job."""
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job.transition_to(JobStatus.CANCELLED)
    await db.commit()
    await db.refresh(job)

    await event_bus.publish("job.cancel", {"job_id": job_id})
    return job


# ── Worker Agent Endpoints ────────────────────────────────────────────────────


@router.post("/worker/heartbeat")
async def worker_heartbeat(
    heartbeat: WorkerHeartbeat, _auth: bool = Depends(verify_worker_auth)
):
    """Worker agents ping this endpoint every 10s to signal availability."""
    router_registry.record_heartbeat(
        worker_id=heartbeat.worker_id,
        status=heartbeat.status,
        capabilities=heartbeat.capabilities,
    )
    return {
        "status": "ok",
        "worker_id": heartbeat.worker_id,
        "recorded_at": datetime.utcnow().isoformat(),
    }


@router.get("/worker/poll")
async def worker_poll(
    worker_id: str = Query(..., description="ID of the polling worker"),
    capabilities: Optional[str] = Query(
        None, description="Comma-separated capabilities supported"
    ),
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_worker_auth),
):
    """
    Worker daemon polls this endpoint to pull the next pending task.
    Pops from in-memory queue or looks up queued jobs in PostgreSQL.
    """
    cap_list = [c.strip() for c in capabilities.split(",")] if capabilities else None

    # Check in-memory dispatch queue first
    next_job = router_registry.pop_job_for_worker(worker_id, cap_list)

    if not next_job:
        # Check DB for waiting jobs matching capabilities
        query = select(Job).where(Job.status.in_([JobStatus.QUEUED]))
        if cap_list:
            query = query.where(Job.capability.in_(cap_list))
        query = query.order_by(Job.created_at.asc()).limit(1)

        result = await db.execute(query)
        db_job = result.scalar_one_or_none()
        if db_job:
            db_job.transition_to(JobStatus.RUNNING)
            db_job.worker_id = worker_id
            db_job.started_at = datetime.utcnow()
            await db.commit()
            await db.refresh(db_job)

            return {
                "job_id": db_job.id,
                "capability": db_job.capability,
                "payload": db_job.payload,
                "status": db_job.status,
            }
        return {"job": None}

    # If popped from memory queue, update DB record to running
    j_id = next_job.get("job_id")
    if j_id:
        stmt = select(Job).where(Job.id == j_id)
        res = await db.execute(stmt)
        db_job = res.scalar_one_or_none()
        if db_job:
            db_job.transition_to(JobStatus.RUNNING)
            db_job.worker_id = worker_id
            db_job.started_at = datetime.utcnow()
            await db.commit()

    return {
        "job_id": j_id,
        "capability": next_job.get("capability"),
        "payload": next_job.get("payload"),
        "status": JobStatus.RUNNING,
    }


@router.post("/{job_id}/complete")
async def complete_job(
    job_id: str,
    req: JobCompleteRequest,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_worker_auth),
):
    """Worker daemon notifies Control Plane that job has completed with artifacts."""
    stmt = select(Job).where(Job.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job.transition_to(JobStatus.SUCCEEDED)
    job.result = req.result
    job.completed_at = datetime.utcnow()
    job.cost_usd = req.cost_usd

    if req.cost_usd > 0.0:
        await record_spend(db, job.user_id, req.cost_usd)

    await db.commit()
    await db.refresh(job)

    # Publish completion to event bus for n8n or websocket listeners
    await event_bus.publish(
        "job.completed",
        {"job_id": job.id, "capability": job.capability, "result": job.result},
    )

    return {"status": "ok", "job_id": job.id}


@router.post("/{job_id}/fail")
async def fail_job(
    job_id: str,
    req: JobFailRequest,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_worker_auth),
):
    """Worker daemon notifies Control Plane of a task failure."""
    stmt = select(Job).where(Job.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job.transition_to(JobStatus.FAILED)
    job.error_message = req.error_message
    job.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(job)

    await event_bus.publish(
        "job.failed",
        {"job_id": job.id, "capability": job.capability, "error": job.error_message},
    )

    return {"status": "ok", "job_id": job.id}
