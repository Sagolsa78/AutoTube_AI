import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.api.routes.jobs import JobCreateRequest, WorkerCapability, create_job
from backend.models.models import Job, JobStatus, User


@pytest.mark.asyncio
async def test_create_job_idempotency(monkeypatch):
    mock_db = AsyncMock()
    mock_user = User(id="user-123")

    # Setup request with idempotency key
    req = JobCreateRequest(
        capability=WorkerCapability.RENDER,
        payload={"video_id": "vid1", "story_spec": {"topic": "T", "scenes": []}},
        idempotency_key="idemp-key-789",
    )

    # Mock DB finding an existing job
    existing_job = Job(
        id="job-existing", idempotency_key="idemp-key-789", status=JobStatus.QUEUED
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_job
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Call create_job directly
    response = await create_job(request=req, user=mock_user, db=mock_db)

    # Verify it returns the existing job without adding a new one
    assert response.id == "job-existing"
    mock_db.add.assert_not_called()

    # Now test when no existing job is found
    mock_result.scalar_one_or_none.return_value = None

    # Mock active_count and daily_count queries to return 0
    mock_result.scalar.return_value = 0

    # Mock dispatch_job
    mock_dispatch = AsyncMock(
        return_value={
            "status": JobStatus.QUEUED,
            "worker_id": "test",
            "worker_type": "local",
        }
    )
    monkeypatch.setattr("backend.api.routes.jobs.dispatch_job", mock_dispatch)

    response = await create_job(request=req, user=mock_user, db=mock_db)

    # Verify it creates a new job
    assert response.id != "job-existing"
    assert response.idempotency_key == "idemp-key-789"
    mock_db.add.assert_called_once()
