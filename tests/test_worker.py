import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from backend.models.models import Video, VideoStatus, Script, Scene, Idea, Channel, User
from engine.story.schemas import StorySpec, SceneSpec

@pytest.mark.asyncio
async def test_worker_reconstructs_render_job():
    video = Video(id="vid_test_1", script_id="script_test_1", status=VideoStatus.rendering, caption_style="bold_centered", style="fast_facts")
    script = Script(id="script_test_1", idea_id="idea_test_1", full_text="Full narration text", body={"topic": "Test Topic"})
    scene1 = Scene(id="sc1", scene_number=1, narration="Scene 1 narration", visual_description="Scene 1 visual")
    script.scenes = [scene1]
    idea = Idea(id="idea_test_1", topic="Test Topic", channel_id="ch_test_1")
    channel = Channel(id="ch_test_1", niche="science_wow", language="en")
    profile = UserProfile(id="default-user")

    # Mock DB execute and get
    class MockResult:
        def __init__(self, item):
            self.item = item
        def scalars(self):
            class Scalars:
                def __init__(self, it): self.it = it
                def first(self): return self.it
            return Scalars(self.item)

    mock_db = AsyncMock()
    # First execute returns video, subsequent can return None to cancel loop
    execute_calls = 0
    async def mock_execute(stmt):
        nonlocal execute_calls
        execute_calls += 1
        if execute_calls == 1:
            return MockResult(video)
        elif execute_calls == 2:
            return MockResult(script)
        return MockResult(None)

    async def mock_get(model, id):
        if model == Idea: return idea
        if model == Channel: return channel
        if model == UserProfile: return profile
        if model == Video: return video
        return None

    mock_db.execute = mock_execute
    mock_db.get = mock_get
    mock_db.commit = AsyncMock()

    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__.return_value = mock_db
    mock_session_ctx.__aexit__.return_value = AsyncMock()

    rendered_job = None
    async def mock_run_render(video_id, job):
        nonlocal rendered_job
        rendered_job = job
        raise asyncio.CancelledError() # Stop polling loop cleanly

    with patch("backend.worker.AsyncSessionLocal", return_value=mock_session_ctx), \
         patch("backend.api.routes.videos._run_render", side_effect=mock_run_render):
        from backend.worker import poll_jobs
        try:
            await poll_jobs()
        except asyncio.CancelledError:
            pass

    assert rendered_job is not None
    assert rendered_job.video_id == "vid_test_1"
    assert isinstance(rendered_job.story_spec, StorySpec)
    assert rendered_job.niche == "science_wow"
    assert len(rendered_job.story_spec.scenes) == 1
    assert rendered_job.story_spec.scenes[0].narration == "Scene 1 narration"
