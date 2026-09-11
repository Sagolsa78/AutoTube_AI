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
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Job, JobStatus, User
from backend.auth.dependencies import get_current_user
from backend.worker_router import (
    dispatch_job,
    router_registry,
    record_spend,
    get_compute_telemetry,
    WorkerCapability,
    WorkerStatus
)
from backend.events import event_bus

router = APIRouter()
log = logging.getLogger(__name__)


# ── Request / Response Schemas ────────────────────────────────────────────────

class JobCreateRequest(BaseModel):
    capability: WorkerCapability
    payload: Dict[str, Any] = {}
    priority: Optional[int] = 1


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
    db: AsyncSession = Depends(get_db)
):
    """Submit a compute job. Enforces the §5 Worker Router decision tree."""
    job_id = str(uuid.uuid4())

    # 1. Route via Worker Router
    route_meta = await dispatch_job(job_id, request.capability, request.payload, db=db)

    # 2. Persist canonical record into PostgreSQL (single source of truth)
    new_job = Job(
        id=job_id,
        user_id=user.id,
        capability=request.capability.value,
        status=route_meta["status"],
        payload=request.payload,
        worker_id=route_meta.get("worker_id"),
        worker_type=route_meta.get("worker_type", "local"),
        cost_usd=0.0,
        created_at=datetime.utcnow()
    )
    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)

    return new_job


@router.get("/telemetry")
async def get_telemetry(db: AsyncSession = Depends(get_db)):
    """Exposes real-time worker cluster status and daily GPU spend for UI dashboard."""
    return await get_compute_telemetry(db=db)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_status(
    job_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
    db: AsyncSession = Depends(get_db)
):
    """Cancel a running or queued compute job."""
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job.status = JobStatus.cancelled.value
    await db.commit()
    await db.refresh(job)

    await event_bus.publish("job.cancel", {"job_id": job_id})
    return job


# ── Worker Agent Endpoints ────────────────────────────────────────────────────

@router.post("/worker/heartbeat")
async def worker_heartbeat(heartbeat: WorkerHeartbeat):
    """Worker agents ping this endpoint every 10s to signal availability."""
    router_registry.record_heartbeat(
        worker_id=heartbeat.worker_id,
        status=heartbeat.status,
        capabilities=heartbeat.capabilities
    )
    return {
        "status": "ok",
        "worker_id": heartbeat.worker_id,
        "recorded_at": datetime.utcnow().isoformat()
    }


@router.get("/worker/poll")
async def worker_poll(
    worker_id: str = Query(..., description="ID of the polling worker"),
    capabilities: Optional[str] = Query(None, description="Comma-separated capabilities supported"),
    db: AsyncSession = Depends(get_db)
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
        query = select(Job).where(
            Job.status.in_([JobStatus.queued.value, JobStatus.waiting_for_local_worker.value])
        )
        if cap_list:
            query = query.where(Job.capability.in_(cap_list))
        query = query.order_by(Job.created_at.asc()).limit(1)

        result = await db.execute(query)
        db_job = result.scalar_one_or_none()
        if db_job:
            db_job.status = JobStatus.running.value
            db_job.worker_id = worker_id
            db_job.started_at = datetime.utcnow()
            await db.commit()
            await db.refresh(db_job)

            return {
                "job_id": db_job.id,
                "capability": db_job.capability,
                "payload": db_job.payload,
                "status": db_job.status
            }
        return {"job": None}

    # If popped from memory queue, update DB record to running
    j_id = next_job.get("job_id")
    if j_id:
        stmt = select(Job).where(Job.id == j_id)
        res = await db.execute(stmt)
        db_job = res.scalar_one_or_none()
        if db_job:
            db_job.status = JobStatus.running.value
            db_job.worker_id = worker_id
            db_job.started_at = datetime.utcnow()
            await db.commit()

    return {
        "job_id": j_id,
        "capability": next_job.get("capability"),
        "payload": next_job.get("payload"),
        "status": JobStatus.running.value
    }


@router.post("/{job_id}/complete")
async def complete_job(
    job_id: str,
    req: JobCompleteRequest,
    db: AsyncSession = Depends(get_db)
):
    """Worker daemon notifies Control Plane that job has completed with artifacts."""
    stmt = select(Job).where(Job.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job.status = JobStatus.completed.value
    job.result = req.result
    job.completed_at = datetime.utcnow()
    job.cost_usd = req.cost_usd

    if req.cost_usd > 0.0:
        await record_spend(db, req.cost_usd)

    await db.commit()
    await db.refresh(job)

    # Publish completion to event bus for n8n or websocket listeners
    await event_bus.publish("job.completed", {
        "job_id": job.id,
        "capability": job.capability,
        "result": job.result
    })

    return {"status": "ok", "job_id": job.id}


@router.post("/{job_id}/fail")
async def fail_job(
    job_id: str,
    req: JobFailRequest,
    db: AsyncSession = Depends(get_db)
):
    """Worker daemon notifies Control Plane of a task failure."""
    stmt = select(Job).where(Job.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job.status = JobStatus.failed.value
    job.error_message = req.error_message
    job.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(job)

    await event_bus.publish("job.failed", {
        "job_id": job.id,
        "capability": job.capability,
        "error": job.error_message
    })

    return {"status": "ok", "job_id": job.id}

