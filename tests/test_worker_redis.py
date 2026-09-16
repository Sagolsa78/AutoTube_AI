import asyncio
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.models.models import Job, JobStatus
from backend.worker.main import _shutdown_requested, consume_redis_stream, execute_job


@pytest.fixture
def mock_redis():
    mock = AsyncMock()
    mock.xreadgroup.return_value = [
        (
            "autotube:jobs:local_pc",
            [
                (
                    "12345-0",
                    {"job_id": "job-123", "capability": "RENDER", "payload": "{}"},
                )
            ],
        )
    ]
    return mock


@pytest.mark.asyncio
async def test_redis_consumer_claims_and_executes(mock_redis, monkeypatch):
    # Reset global state for tests
    import backend.worker.main as main_mod

    main_mod._shutdown_requested = False

    # Mock get_redis
    monkeypatch.setattr(
        "backend.worker.main.get_redis", AsyncMock(return_value=mock_redis)
    )

    # Mock execute_job
    mock_execute = AsyncMock(return_value=True)
    monkeypatch.setattr("backend.worker.main.execute_job", mock_execute)

    # We need to stop the loop after one iteration
    async def stop_loop(*args, **kwargs):
        import backend.worker.main as main_mod

        main_mod._shutdown_requested = True
        return [
            (
                "autotube:jobs:local_pc",
                [
                    (
                        "12345-0",
                        {"job_id": "job-123", "capability": "RENDER", "payload": "{}"},
                    )
                ],
            )
        ]

    mock_redis.xreadgroup = AsyncMock(side_effect=stop_loop)

    await consume_redis_stream("local_pc", "autotube:jobs:local_pc", "autotube_workers")

    # Ensure execute_job was called with the job_id from redis
    mock_execute.assert_called_once_with("job-123")

    # Ensure message was acknowledged
    mock_redis.xack.assert_called_once_with(
        "autotube:jobs:local_pc", "autotube_workers", "12345-0"
    )


@pytest.mark.asyncio
async def test_redis_consumer_empty_stream(mock_redis, monkeypatch):
    # Reset global state for tests
    import backend.worker.main as main_mod

    main_mod._shutdown_requested = False

    mock_redis.xreadgroup.return_value = []  # Empty stream

    monkeypatch.setattr(
        "backend.worker.main.get_redis", AsyncMock(return_value=mock_redis)
    )

    mock_execute = AsyncMock()
    monkeypatch.setattr("backend.worker.main.execute_job", mock_execute)

    async def stop_loop(*args, **kwargs):
        import backend.worker.main as main_mod

        main_mod._shutdown_requested = True
        return []

    mock_redis.xreadgroup = AsyncMock(side_effect=stop_loop)

    await consume_redis_stream("local_pc", "autotube:jobs:local_pc", "autotube_workers")

    # Should not have called execute_job or xack
    mock_execute.assert_not_called()
    mock_redis.xack.assert_not_called()
