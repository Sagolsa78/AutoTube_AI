import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.models.models import Job, JobStatus
from backend.worker.main import _shutdown_requested, watchdog
from engine.models import RenderJob


@pytest.mark.asyncio
async def test_watchdog_reaps_expired_lease(monkeypatch):
    # Setup mock job with expired lease
    now = datetime.now(timezone.utc)
    expired_job = Job(
        id="job-expired-123",
        status=JobStatus.RUNNING,
        lease_expires_at=now - timedelta(seconds=10),
        started_at=now - timedelta(minutes=2),
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [expired_job]

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    mock_session_local = MagicMock()
    mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr("backend.worker.main.AsyncSessionLocal", mock_session_local)

    # Stop loop after first iteration
    async def mock_sleep(*args, **kwargs):
        import backend.worker.main as main_mod

        main_mod._shutdown_requested = True

    monkeypatch.setattr("asyncio.sleep", AsyncMock(side_effect=mock_sleep))

    import backend.worker.main as main_mod

    main_mod._shutdown_requested = False

    await watchdog()

    # Verify job status was transitioned to FAILED
    assert expired_job.status == JobStatus.FAILED
    assert expired_job.error_message == "Job lease expired (worker disconnected)."
    mock_db.commit.assert_called_once()
