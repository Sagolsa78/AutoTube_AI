import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from backend.models.models import Video, VideoStatus, Job, JobStatus
from engine.story.schemas import StorySpec

class MockAsyncSession:
    def __init__(self, db):
        self.db = db
    async def __aenter__(self):
        return self.db
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

@pytest.mark.asyncio
async def test_worker_execute_job_success():
    video = Video(id="vid_test_1", script_id="script_test_1", status=VideoStatus.ready, caption_style="bold_centered", style="fast_facts")
    story_spec_data = {
        "topic": "Test Topic",
        "scenes": [{"scene_number": 1, "narration": "Scene 1 narration", "visual_intent": "Scene 1 visual"}]
    }
    payload = {
        "video_id": "vid_test_1",
        "story_spec": story_spec_data,
        "niche": "science_wow",
        "caption_style": "bold_centered",
        "style": "fast_facts",
        "language": "en"
    }
    job_rec = Job(id="job_1", capability="RENDER", status=JobStatus.queued.value, payload=payload)

    mock_db = AsyncMock()
    async def mock_get(model, id):
        if model == Video: return video
        if model == Job: return job_rec
        return None

    mock_db.get = mock_get
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    rendered_job = None
    async def mock_run_render(video_id, job, job_id=None):
        nonlocal rendered_job
        rendered_job = job

    with patch("backend.worker.main.AsyncSessionLocal", side_effect=lambda: MockAsyncSession(mock_db)), \
         patch("backend.services.rendering_service.run_job", side_effect=mock_run_render):
        from backend.worker.main import execute_job
        success = await execute_job("job_1")

    assert success is True
    assert job_rec.status == JobStatus.completed.value
    assert rendered_job is not None
    assert rendered_job.video_id == "vid_test_1"
    assert isinstance(rendered_job.story_spec, StorySpec)
    assert rendered_job.niche == "science_wow"
    assert len(rendered_job.story_spec.scenes) == 1
    assert rendered_job.story_spec.scenes[0].narration == "Scene 1 narration"

@pytest.mark.asyncio
async def test_worker_execute_job_failure():
    video = Video(id="vid_test_fail", script_id="script_test_1", status=VideoStatus.failed, notes="FFmpeg error")
    payload = {
        "video_id": "vid_test_fail",
        "story_spec": {"topic": "T", "scenes": []},
        "niche": "science_wow"
    }
    job_rec = Job(id="job_fail_1", capability="RENDER", status=JobStatus.queued.value, payload=payload)

    mock_db = AsyncMock()
    async def mock_get(model, id):
        if model == Video: return video
        if model == Job: return job_rec
        return None

    mock_db.get = mock_get
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def mock_run_render(video_id, job, job_id=None):
        raise RuntimeError("FFmpeg crashed")

    with patch("backend.worker.main.AsyncSessionLocal", side_effect=lambda: MockAsyncSession(mock_db)), \
         patch("backend.services.rendering_service.run_job", side_effect=mock_run_render):
        from backend.worker.main import execute_job
        success = await execute_job("job_fail_1")

    assert success is False
    assert job_rec.status == JobStatus.failed.value
    assert "FFmpeg crashed" in (job_rec.error_message or "")


