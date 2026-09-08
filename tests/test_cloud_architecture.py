"""
Automated Integration Tests for AutoTube Cloud Architecture (§10 Phase 1).
Tests:
  - Job & DailyComputeSpend Database Models
  - Worker Router & Registry (Heartbeats, Local-first routing, Budget-capped fallback, Queueing)
  - Compute Plane Telemetry
  - Control Plane Security Dependency
  - Cloud Storage URL Resolution
"""
import os
import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

from backend.models.models import Job, JobStatus, DailyComputeSpend
from backend.worker_router import (
    WorkerRegistry,
    WorkerStatus,
    WorkerCapability,
    dispatch_job,
    get_compute_telemetry
)
from backend.security import verify_control_plane_auth
from backend.cloud_storage import CloudStorage


# ── 1. Model Schema Tests ─────────────────────────────────────────────────────

def test_job_model_fields():
    job = Job(
        id="test-job-uuid",
        capability=WorkerCapability.RENDER.value,
        status=JobStatus.queued.value,
        payload={"script_id": "sc-123", "style": "cinematic"},
        worker_id="local_pc",
        worker_type="local",
        cost_usd=0.0
    )
    assert job.id == "test-job-uuid"
    assert job.capability == "RENDER"
    assert job.status == "queued"
    assert job.payload["script_id"] == "sc-123"
    assert job.cost_usd == 0.0


def test_daily_compute_spend_model():
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    spend = DailyComputeSpend(
        date=today_str,
        amount_spent_usd=0.58,
        budget_cap_usd=2.00,
        jobs_count=1
    )
    assert spend.date == today_str
    assert spend.amount_spent_usd == 0.58
    assert spend.budget_cap_usd == 2.00
    assert spend.jobs_count == 1


# ── 2. Worker Registry & Heartbeat Tests ───────────────────────────────────────

def test_worker_registry_heartbeat_and_timeout():
    registry = WorkerRegistry()
    # Initially offline
    assert registry.is_worker_online("local_pc") is False

    # Receive heartbeat
    registry.record_heartbeat("local_pc", WorkerStatus.AVAILABLE, ["LLM", "TTS", "RENDER"])
    assert registry.is_worker_online("local_pc") is True
    assert registry.get_worker_status("local_pc") == "online"

    # Simulate timeout (> 30s ago)
    registry.workers["local_pc"]["last_heartbeat"] = 100.0
    assert registry.is_worker_online("local_pc") is False
    assert registry.get_worker_status("local_pc") == "offline"


# ── 3. Worker Router Decision Engine Tests (§5) ───────────────────────────────

@pytest.mark.asyncio
async def test_router_local_first_when_online():
    """When local worker is online, router must ALWAYS dispatch to local RTX 3050 ($0)."""
    from backend.worker_router import router_registry

    # Bring local worker online
    router_registry.record_heartbeat("local_pc", WorkerStatus.AVAILABLE)

    job_data = await dispatch_job(
        job_id="job-local-test",
        capability=WorkerCapability.RENDER,
        payload={"test": True}
    )

    assert job_data["worker_id"] == "local_pc"
    assert job_data["worker_type"] == "local"
    assert job_data["status"] == JobStatus.dispatched.value


@pytest.mark.asyncio
async def test_router_burst_to_cloud_when_local_offline_and_budget_available():
    """When local is offline but RunPod is configured and under budget, burst to RunPod."""
    from backend.worker_router import router_registry
    # Force local offline
    router_registry.workers["local_pc"]["last_heartbeat"] = 0.0

    mock_db = AsyncMock()
    mock_spend = DailyComputeSpend(date="2026-09-08", amount_spent_usd=0.50, budget_cap_usd=2.00)
    
    class MockResult:
        def scalar_one_or_none(self): return mock_spend

    mock_db.execute.return_value = MockResult()

    with patch.dict(os.environ, {"RUNPOD_API_KEY": "rpa_test_key_123"}):
        job_data = await dispatch_job(
            job_id="job-cloud-burst-test",
            capability=WorkerCapability.RENDER,
            payload={"test": True},
            db=mock_db
        )

        assert job_data["worker_id"] == "runpod_serverless"
        assert job_data["worker_type"] == "cloud_gpu"
        assert job_data["status"] == JobStatus.dispatched.value


@pytest.mark.asyncio
async def test_router_queues_when_budget_cap_exceeded():
    """When local is offline and daily budget cap is exhausted, job must queue ($0 safety guard)."""
    from backend.worker_router import router_registry
    router_registry.workers["local_pc"]["last_heartbeat"] = 0.0

    mock_db = AsyncMock()
    # Spent $2.50 against a $2.00 budget cap
    mock_spend = DailyComputeSpend(date="2026-09-08", amount_spent_usd=2.50, budget_cap_usd=2.00)

    class MockResult:
        def scalar_one_or_none(self): return mock_spend

    mock_db.execute.return_value = MockResult()

    with patch.dict(os.environ, {"RUNPOD_API_KEY": "rpa_test_key_123"}):
        job_data = await dispatch_job(
            job_id="job-budget-exceeded-test",
            capability=WorkerCapability.RENDER,
            payload={"test": True},
            db=mock_db
        )

        assert job_data["worker_id"] == "local_pc"
        assert job_data["status"] == JobStatus.waiting_for_local_worker.value


# ── 4. Telemetry Aggregation Test ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_compute_telemetry_payload():
    from backend.worker_router import router_registry
    router_registry.record_heartbeat("local_pc", WorkerStatus.AVAILABLE)

    mock_db = AsyncMock()
    mock_spend = DailyComputeSpend(date="2026-09-08", amount_spent_usd=0.75, budget_cap_usd=2.00, jobs_count=2)

    class MockResult:
        def scalar_one_or_none(self): return mock_spend

    mock_db.execute.return_value = MockResult()

    telemetry = await get_compute_telemetry(db=mock_db)

    assert telemetry["strategy"] == "local-first"
    assert telemetry["local_worker"]["name"] == "Local RTX 3050"
    assert telemetry["local_worker"]["status"] == "online"
    assert telemetry["cloud_burst"]["daily_budget_usd"] == 2.00
    assert telemetry["cloud_burst"]["today_spent_usd"] == 0.75
    assert telemetry["cloud_burst"]["budget_remaining_usd"] == 1.25


# ── 5. Control Plane Security Dependency Tests ────────────────────────────────

@pytest.mark.asyncio
async def test_security_dev_bypass():
    """In development without an API key, requests must pass with zero friction."""
    mock_request = MagicMock()
    with patch.dict(os.environ, {"APP_ENV": "development", "AUTOTUBE_API_KEY": "", "AUTH_DISABLED": "false"}):
        from backend import security
        # reload config vars in security
        security.API_KEY = ""
        security.APP_ENV = "development"
        security.AUTH_DISABLED = False

        res = await verify_control_plane_auth(mock_request, api_key=None, bearer=None)
        assert res is True


@pytest.mark.asyncio
async def test_security_enforces_key_when_configured():
    """When an API key is set, unauthorized requests must receive 401."""
    from fastapi import HTTPException
    mock_request = MagicMock()
    mock_request.headers = {}
    mock_request.client.host = "1.2.3.4"

    from backend import security
    security.API_KEY = "super-secret-key"
    security.APP_ENV = "production"
    security.AUTH_DISABLED = False

    # Missing credentials -> 401
    with pytest.raises(HTTPException) as exc_info:
        await verify_control_plane_auth(mock_request, api_key=None, bearer=None)
    assert exc_info.value.status_code == 401

    # Valid X-API-Key -> allowed
    valid = await verify_control_plane_auth(mock_request, api_key="super-secret-key", bearer=None)
    assert valid is True


# ── 6. Cloud Storage URL Resolution Tests ──────────────────────────────────────

def test_cloud_storage_public_url_resolution():
    # Local fallback
    local_storage = CloudStorage(provider="local")
    assert local_storage.get_public_url("videos/test.mp4") == "/static/videos/test.mp4"

    # Cloudflare R2 with custom public domain
    with patch.dict(os.environ, {"R2_PUBLIC_DOMAIN": "https://media.autotube.ai"}):
        r2_storage = CloudStorage(provider="r2")
        assert r2_storage.get_public_url("videos/test.mp4") == "https://media.autotube.ai/videos/test.mp4"
