"""
Worker Router
Routes compute-heavy jobs (LLM, TTS, IMAGE, VIDEO, RENDER, ALIGNMENT).
Enforces the Control Plane / Compute Plane boundary (§5):
  1. Local RTX 3050 available? -> Run locally ($0)
  2. Local worker offline?     -> Today's GPU budget available?
                                    -> YES -> Burst to RunPod
                                    -> NO  -> Queue until local worker returns
"""
from __future__ import annotations
import os
import time
import logging
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.models import Job, JobStatus, DailyComputeSpend
from backend.events import event_bus
from backend.core.config import settings
from backend.jobs.github_executor import GitHubActionsJobExecutor

log = logging.getLogger(__name__)

DAILY_GPU_BUDGET_CAP = settings.DAILY_GPU_BUDGET_CAP
HEARTBEAT_TIMEOUT_SECONDS = 30 # Default hardcoded or add to config if needed


class WorkerCapability(str, Enum):
    LLM = "LLM"
    TTS = "TTS"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    RENDER = "RENDER"
    ALIGNMENT = "ALIGNMENT"


class WorkerStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"


class WorkerRegistry:
    """
    In-memory registry synchronized with Redis heartbeats.
    Tracks worker status, capabilities, and health pings.
    """
    def __init__(self):
        self.workers: Dict[str, Dict[str, Any]] = {
            "cloud_worker": {
                "name": "Cloud Container Engine (Zero-Laptop)",
                "capabilities": [
                    WorkerCapability.LLM.value,
                    WorkerCapability.TTS.value,
                    WorkerCapability.IMAGE.value,
                    WorkerCapability.VIDEO.value,
                    WorkerCapability.RENDER.value,
                    WorkerCapability.ALIGNMENT.value,
                ],
                "status": WorkerStatus.AVAILABLE.value,
                "last_heartbeat": time.time(),
            },
            "local_pc": {
                "name": "Local RTX 3050",
                "capabilities": [
                    WorkerCapability.LLM.value,
                    WorkerCapability.TTS.value,
                    WorkerCapability.IMAGE.value,
                    WorkerCapability.VIDEO.value,
                    WorkerCapability.RENDER.value,
                    WorkerCapability.ALIGNMENT.value,
                ],
                "status": WorkerStatus.OFFLINE.value,
                "last_heartbeat": 0.0,
            },
            "runpod_serverless": {
                "name": "RunPod Serverless Flex GPU",
                "capabilities": [
                    WorkerCapability.IMAGE.value,
                    WorkerCapability.VIDEO.value,
                    WorkerCapability.RENDER.value,
                ],
                "status": WorkerStatus.AVAILABLE.value if getattr(settings, "RUNPOD_API_KEY", None) else WorkerStatus.OFFLINE.value,
                "last_heartbeat": time.time(),
            }
        }
        # In-memory job queue for workers that poll
        self.job_queues: Dict[str, List[Dict[str, Any]]] = {
            "cloud_worker": [],
            "local_pc": [],
            "runpod_serverless": []
        }

    def record_heartbeat(self, worker_id: str, status: WorkerStatus = WorkerStatus.AVAILABLE, capabilities: List[str] = None):
        now = time.time()
        if worker_id not in self.workers:
            self.workers[worker_id] = {
                "name": worker_id,
                "capabilities": capabilities or [c.value for c in WorkerCapability],
                "status": status.value,
                "last_heartbeat": now
            }
        else:
            self.workers[worker_id]["status"] = status.value
            self.workers[worker_id]["last_heartbeat"] = now
            if capabilities:
                self.workers[worker_id]["capabilities"] = capabilities
        log.debug(f"[WorkerRegistry] Heartbeat from {worker_id} (status={status.value})")

    def is_worker_online(self, worker_id: str) -> bool:
        if worker_id == "cloud_worker":
            return True
        worker = self.workers.get(worker_id)
        if not worker:
            return False
        # Serverless is online if configured
        if worker_id == "runpod_serverless":
            return bool(getattr(settings, "RUNPOD_API_KEY", None))
        return (time.time() - worker["last_heartbeat"]) < HEARTBEAT_TIMEOUT_SECONDS

    def get_worker_status(self, worker_id: str) -> str:
        return "online" if self.is_worker_online(worker_id) else "offline"

    def enqueue_job_for_worker(self, worker_id: str, job_dict: Dict[str, Any]):
        if worker_id not in self.job_queues:
            self.job_queues[worker_id] = []
        self.job_queues[worker_id].append(job_dict)

    def pop_job_for_worker(self, worker_id: str, capabilities: List[str] = None) -> Optional[Dict[str, Any]]:
        queue = self.job_queues.get(worker_id, [])
        if not queue:
            return None
        if not capabilities:
            return queue.pop(0) if queue else None
        
        for idx, item in enumerate(queue):
            if item.get("capability") in capabilities:
                return queue.pop(idx)
        return None


router_registry = WorkerRegistry()


# ── Daily Budget Accounting ───────────────────────────────────────────────────

async def get_or_create_daily_spend(db: AsyncSession) -> DailyComputeSpend:
    """Retrieve or initialize today's compute spend record."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    stmt = select(DailyComputeSpend).where(DailyComputeSpend.date == today_str)
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        record = DailyComputeSpend(
            date=today_str,
            amount_spent_usd=0.0,
            budget_cap_usd=DAILY_GPU_BUDGET_CAP,
            jobs_count=0
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
    return record


async def record_spend(db: AsyncSession, amount_usd: float):
    """Increment today's compute spend."""
    record = await get_or_create_daily_spend(db)
    record.amount_spent_usd += max(0.0, amount_usd)
    record.jobs_count += 1
    await db.commit()
    await db.refresh(record)


# ── Routing Decision Engine ───────────────────────────────────────────────────

async def dispatch_job(
    job_id: str,
    capability: WorkerCapability | str,
    payload: Dict[str, Any],
    db: Optional[AsyncSession] = None
) -> Dict[str, Any]:
    """
    Executes the §5 Worker Router decision tree:
      1. Local worker online?  -> Route to RTX 3050 ($0)
      2. Local worker offline? -> Check today's GPU budget:
                                    -> Under budget -> Burst to RunPod
                                    -> Over budget  -> Hold in queue for local worker
    """
    cap_str = capability.value if isinstance(capability, WorkerCapability) else capability
    strategy = getattr(settings, "COMPUTE_STRATEGY", "local-first")
    zero_laptop = getattr(settings, "ZERO_LAPTOP_MODE", "false").lower() in ("true", "1")
    local_online = router_registry.is_worker_online("local_pc")

    chosen_worker = None
    worker_type = "local"
    status = JobStatus.dispatched.value

    if strategy == "cloud-native" or zero_laptop:
        chosen_worker = "cloud_worker"
        worker_type = "cloud_container"
        log.info(f"[WorkerRouter] Zero-laptop mode active. Routing job {job_id} ({cap_str}) to Cloud Container Engine ($0).")
    elif local_online:
        chosen_worker = "local_pc"
        worker_type = "local"
        log.info(f"[WorkerRouter] Routing job {job_id} ({cap_str}) to Local RTX 3050 ($0).")
    else:
        # Check budget for cloud burst
        today_spent = 0.0
        budget_cap = DAILY_GPU_BUDGET_CAP
        if db:
            spend_record = await get_or_create_daily_spend(db)
            today_spent = spend_record.amount_spent_usd
            budget_cap = spend_record.budget_cap_usd

        has_runpod = bool(getattr(settings, "RUNPOD_API_KEY", None))
        has_budget = (today_spent < budget_cap)

        if has_runpod and has_budget:
            chosen_worker = "runpod_serverless"
            worker_type = "cloud_gpu"
            log.info(f"[WorkerRouter] Local offline. Bursting job {job_id} ({cap_str}) to RunPod (spent: ${today_spent:.2f}/${budget_cap:.2f}).")
        else:
            chosen_worker = "local_pc"
            worker_type = "local"
            status = JobStatus.waiting_for_local_worker.value
            log.warning(
                f"[WorkerRouter] Local offline and cloud burst unavailable (has_runpod={has_runpod}, budget_left=${max(0.0, budget_cap - today_spent):.2f}). "
                f"Queueing job {job_id} until local worker returns."
            )

    job_data = {
        "job_id": job_id,
        "capability": cap_str,
        "status": status,
        "worker_id": chosen_worker,
        "worker_type": worker_type,
        "payload": payload,
        "dispatched_at": datetime.utcnow().isoformat()
    }

    # Queue for worker consumption
    router_registry.enqueue_job_for_worker(chosen_worker, job_data)
    
    if chosen_worker == "cloud_worker":
        # Dispatch to GitHub Actions
        import asyncio
        github_executor = GitHubActionsJobExecutor()
        asyncio.create_task(github_executor.submit(job_id, payload))

    # Publish to Redis event bus
    await event_bus.publish(f"job.{status}.{chosen_worker}", job_data)

    return job_data


# ── Telemetry Aggregator ──────────────────────────────────────────────────────

async def get_compute_telemetry(db: Optional[AsyncSession] = None) -> Dict[str, Any]:
    """Returns real-time worker status and budget telemetry for Dashboard widget."""
    local_online = router_registry.is_worker_online("local_pc")
    local_meta = router_registry.workers.get("local_pc", {})
    last_hb = local_meta.get("last_heartbeat", 0.0)

    cloud_online = router_registry.is_worker_online("cloud_worker")
    cloud_meta = router_registry.workers.get("cloud_worker", {})

    strategy = getattr(settings, "COMPUTE_STRATEGY", "local-first")

    today_spent = 0.0
    budget_cap = DAILY_GPU_BUDGET_CAP
    jobs_count = 0

    if db:
        try:
            spend_record = await get_or_create_daily_spend(db)
            today_spent = spend_record.amount_spent_usd
            budget_cap = spend_record.budget_cap_usd
            jobs_count = spend_record.jobs_count
        except Exception as e:
            log.warning(f"Could not load daily spend record: {e}")

    runpod_configured = bool(getattr(settings, "RUNPOD_API_KEY", None))

    return {
        "local_worker": {
            "id": "local_pc",
            "name": "Local RTX 3050",
            "status": "online" if local_online else "offline",
            "last_heartbeat": datetime.utcfromtimestamp(last_hb).isoformat() if last_hb > 0 else None,
            "capabilities": local_meta.get("capabilities", []),
        },
        "cloud_worker": {
            "id": "cloud_worker",
            "name": "Cloud Container Engine (Zero-Laptop)",
            "status": "online" if cloud_online else "offline",
            "capabilities": cloud_meta.get("capabilities", []),
        },
        "strategy": strategy,
        "cloud_burst": {
            "provider": "RunPod Serverless",
            "status": "ready" if runpod_configured else "unconfigured",
            "daily_budget_usd": budget_cap,
            "today_spent_usd": round(today_spent, 2),
            "budget_remaining_usd": max(0.0, round(budget_cap - today_spent, 2)),
            "jobs_burst_today": jobs_count,
        }
    }

