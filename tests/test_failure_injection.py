import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.models.models import (
    Channel,
    Idea,
    Job,
    JobStatus,
    Script,
    User,
    Video,
    VideoStatus,
)
from backend.worker.main import execute_job
from engine.models import RenderJob
from engine.story.schemas import StorySpec


class MockAsyncSession:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.mark.asyncio
async def test_worker_crash_mid_render():
    """1. Worker Crash Mid-Render"""
    video = Video(id="vid_fail_1", script_id="script_1", status=VideoStatus.ready)
    payload = {
        "video_id": "vid_fail_1",
        "story_spec": {"topic": "T", "scenes": []},
        "niche": "science_wow",
        "language": "en",
    }
    job_rec = Job(
        id="job_fail_1",
        capability="RENDER",
        status=JobStatus.QUEUED.value,
        payload=payload,
    )

    mock_db = AsyncMock()

    async def mock_get(model, id):
        if model == Video:
            return video
        if model == Job:
            return job_rec
        return None

    mock_db.get = mock_get
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def mock_run_render(video_id, job, job_id=None):
        raise RuntimeError("FFmpeg crashed mid-render")

    with patch(
        "backend.worker.main.AsyncSessionLocal",
        side_effect=lambda: MockAsyncSession(mock_db),
    ), patch("backend.services.rendering_service.run_job", side_effect=mock_run_render):
        success = await execute_job("job_fail_1")

    assert success is False
    assert job_rec.status == JobStatus.FAILED.value
    assert "FFmpeg crashed mid-render" in (job_rec.error_message or "")


@pytest.mark.asyncio
async def test_worker_crash_after_upload_idempotency():
    """2. Worker Crash After Upload (Idempotency)"""
    import os

    from backend.services.rendering_service import run_job

    video = Video(
        id="vid_idem_1",
        script_id="script_idem_1",
        status=VideoStatus.ready,
        user_id="user_1",
    )
    script = Script(id="script_idem_1", idea_id="idea_1")
    idea = Idea(id="idea_1", channel_id="channel_1")
    user = User(id="user_1")
    channel = Channel(id="channel_1")

    # Pre-populate job with audio_path and output_path to trigger skips
    payload = {
        "video_id": "vid_idem_1",
        "story_spec": {
            "topic": "T",
            "scenes": [
                {"scene_number": 1, "narration": "Hello", "visual_intent": "visual"}
            ],
        },
        "niche": "science_wow",
        "language": "en",
        "audio_path": "/tmp/mock_audio.mp3",
        "sub_path": "/tmp/mock_sub.ass",
        "output_path": "/tmp/mock_output.mp4",
        "clip_paths": ["/tmp/mock_clip.mp4"],
    }
    render_job = RenderJob(**payload)

    mock_db = AsyncMock()

    async def mock_get(model, id):
        if model == Video:
            return video
        if model == Script:
            return script
        if model == Idea:
            return idea
        if model == User:
            return user
        if model == Channel:
            return channel
        return None

    mock_db.get = mock_get

    # Fix the res.scalars().first() issue for db.execute
    class FakeResult:
        def scalars(self):
            class FakeScalars:
                def first(self):
                    return script

            return FakeScalars()

    mock_db.execute = AsyncMock(return_value=FakeResult())

    # Mock OS paths to appear existing so it skips TTS and Assembly
    with patch("os.path.exists", return_value=True), patch(
        "os.path.getsize", return_value=100000
    ), patch(
        "backend.services.rendering_service.AsyncSessionLocal",
        side_effect=lambda: MockAsyncSession(mock_db),
    ), patch(
        "backend.services.rendering_service.generate_voiceover"
    ) as mock_tts, patch(
        "backend.services.rendering_service.async_assemble_job"
    ) as mock_assemble, patch(
        "backend.services.rendering_service.storage.put_file",
        AsyncMock(return_value="http://mock.url"),
    ):

        await run_job("vid_idem_1", render_job, "job_idem_1")

        # It should skip TTS and assembly due to existing assets
        mock_tts.assert_not_called()
        mock_assemble.assert_not_called()
        assert video.render_stage == "done"


@pytest.mark.asyncio
async def test_duplicate_job_submission():
    """3. Duplicate Job Submission"""
    from backend.api.routes.jobs import JobCreateRequest, WorkerCapability, create_job

    mock_db = AsyncMock()
    mock_user = User(id="user-dup")
    req = JobCreateRequest(
        capability=WorkerCapability.RENDER,
        payload={"video_id": "vid1", "story_spec": {"topic": "T", "scenes": []}},
        idempotency_key="idem-duplicate-1",
    )

    existing_job = Job(
        id="job-existing-1", idempotency_key="idem-duplicate-1", status=JobStatus.QUEUED
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_job
    mock_db.execute = AsyncMock(return_value=mock_result)

    response = await create_job(request=req, user=mock_user, db=mock_db)

    assert response.id == "job-existing-1"
    mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_duplicate_publish():
    """4. Duplicate Publish"""
    from backend.api.routes.videos import UploadIn, upload_video
    from backend.models.models import Publication

    video = Video(id="vid_pub_1", status=VideoStatus.uploaded)
    pub = Publication(
        video_id="vid_pub_1", youtube_id="123", url="http://youtube.com/watch?v=123"
    )

    mock_db = AsyncMock()

    async def mock_scalar(stmt):
        stmt_str = str(stmt).lower()
        if "publication" in stmt_str:
            return pub
        if "video" in stmt_str:
            return video
        return None

    mock_db.scalar = mock_scalar
    mock_user = User(id="user_1")
    body = UploadIn(title="A", description="B", tags=[], privacy_status="private")

    res = await upload_video("vid_pub_1", body, user=mock_user, db=mock_db)

    # Should idempotently return the existing URL without re-publishing
    assert res.get("status") == "already_uploaded"
    assert res.get("url") == "http://youtube.com/watch?v=123"


@pytest.mark.asyncio
async def test_storage_unavailable():
    """5. Storage Unavailable"""
    from backend.services.rendering_service import run_job

    video = Video(id="vid_stor_1", script_id="script_1", status=VideoStatus.ready)
    render_job = RenderJob(
        video_id="vid_stor_1", story_spec={"topic": "T", "scenes": []}
    )

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=video)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = Script(id="script_1")
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "backend.services.rendering_service.AsyncSessionLocal",
        side_effect=lambda: MockAsyncSession(mock_db),
    ), patch(
        "backend.services.rendering_service.storage.put_file",
        side_effect=ConnectionError("Storage unreachable"),
    ), patch(
        "os.path.exists", return_value=True
    ), patch(
        "os.path.getsize", return_value=1000
    ):

        await run_job("vid_stor_1", render_job, "job_stor_1")

        # Verify job marked as retry or failed in real implementation.
        # But wait, run_job catches the exception and logs it. We must ensure it's handled.
        assert video.status == VideoStatus.failed


@pytest.mark.asyncio
async def test_tts_timeout():
    """6. TTS Timeout"""
    from backend.services.rendering_service import run_job

    video = Video(id="vid_tts_1", script_id="script_1", status=VideoStatus.ready)
    render_job = RenderJob(
        video_id="vid_tts_1", story_spec={"topic": "T", "scenes": []}
    )

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=video)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = Script(id="script_1")
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "backend.services.rendering_service.AsyncSessionLocal",
        side_effect=lambda: MockAsyncSession(mock_db),
    ), patch(
        "backend.services.rendering_service.generate_voiceover",
        side_effect=asyncio.TimeoutError("TTS Timed out"),
    ):

        await run_job("vid_tts_1", render_job, "job_tts_1")
        assert video.status == VideoStatus.failed


@pytest.mark.asyncio
async def test_llm_malformed_json():
    """7. LLM Malformed JSON"""
    from engine.story.planner import StoryPlanner
    from integrations.providers.ai_providers import generate_with_fallback

    planner = StoryPlanner(max_retries=1)

    # Mock generate_with_fallback to return malformed json
    def mock_generate(*args, **kwargs):
        return "[unterminated array", "mock_provider", {"tokens": 10}

    with patch(
        "engine.story.planner.generate_with_fallback", side_effect=mock_generate
    ):
        with pytest.raises(RuntimeError) as exc:
            planner.generate_story("Topic", prompt_template="Prompt {topic}")
        assert "Failed to generate valid StorySpec" in str(exc.value)


@pytest.mark.asyncio
async def test_invalid_asset_corrupt_media():
    """8. Invalid Asset (Corrupt Media)"""
    from backend.services.rendering_service import run_job

    video = Video(id="vid_corr_1", script_id="script_1", status=VideoStatus.ready)
    render_job = RenderJob(
        video_id="vid_corr_1", story_spec={"topic": "T", "scenes": []}
    )

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=video)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = Script(id="script_1")
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "backend.services.rendering_service.AsyncSessionLocal",
        side_effect=lambda: MockAsyncSession(mock_db),
    ), patch("os.path.exists", return_value=True), patch(
        "os.path.getsize", return_value=1000
    ), patch(
        "backend.services.rendering_service.async_assemble_job",
        side_effect=RuntimeError(
            "FFmpeg Error: Invalid data found when processing input"
        ),
    ):

        await run_job("vid_corr_1", render_job, "job_corr_1")
        assert video.status == VideoStatus.failed
