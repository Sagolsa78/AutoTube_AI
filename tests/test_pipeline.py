from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.models.models import (
    Channel,
    Idea,
    IdeaStatus,
    Publication,
    User,
    Video,
    VideoStatus,
)


class MockDB:
    def __init__(self):
        self.added = []
        self.flushed = False
        self.committed = False

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        self.committed = True

    async def flush(self):
        self.flushed = True

    async def get(self, model, id):
        if model == Idea:
            return Idea(
                id="idea1", title="test idea", topic="test topic", channel_id="ch1"
            )
        if model == Video:
            return Video(id=id, script_id="script1")
        if model == Channel:
            return Channel(id="ch1", niche="science_wow")
        return None

    async def execute(self, stmt):
        class MockResult:
            def scalars(self):
                class MockScalars:
                    def all(self):
                        return []

                    def first(self):
                        from backend.models.models import Script, ScriptStatus

                        # Return a script with status used_in_render if we're testing regenerate_script
                        # Otherwise return a default script
                        return Script(
                            id="script1",
                            idea_id="idea1",
                            status=ScriptStatus.used_in_render,
                        )

                return MockScalars()

        return MockResult()

    async def refresh(self, obj):
        pass


from engine.story.schemas import SceneSpec, StorySpec


class MockRenderJob:
    niche: str = "science_wow"
    story_spec: StorySpec = StorySpec(
        topic="test topic",
        scenes=[
            SceneSpec(scene_number=1, narration="test script", visual_intent="test")
        ],
    )
    audio_path: str = "audio.mp3"
    sub_path: str = "subs.ass"
    clip_paths: list = []
    output_path: str = "/tmp/test.mp4"
    duration: float = 15.0
    voice: str = "v1"
    style: str = "realistic"
    caption_style: str = "bold_centered"
    word_boundaries: list = []
    watermark_path: str = None
    watermark_opacity: float = 0.4
    watermark_position: str = "bottom_right"
    watermark_scale: float = 0.12
    language: str = "en"


@pytest.mark.asyncio
@patch("os.path.getsize", return_value=20000)
@patch("backend.services.rendering_service.async_fetch_clips", new_callable=AsyncMock)
@patch("backend.services.rendering_service.generate_voiceover", new_callable=AsyncMock)
@patch("backend.services.rendering_service.async_assemble_job", new_callable=AsyncMock)
@patch("integrations.youtube.uploader.upload_video", new_callable=AsyncMock)
@patch("backend.services.rendering_service.generate_with_fallback")
@patch("backend.services.rendering_service.AsyncSessionLocal")
async def test_metadata_failure_no_auto_publish(
    mock_session_local,
    mock_gen,
    mock_upload,
    mock_assemble,
    mock_tts,
    mock_fetch,
    mock_getsize,
):
    mock_tts.return_value = {
        "audio_path": "a",
        "sub_path": "s",
        "duration": 15.0,
        "voice": "v",
    }
    mock_fetch.return_value = [{"path": "clip1.mp4"}]

    from pathlib import Path

    async def fake_assemble(job):
        Path(job.output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(job.output_path).touch()

    mock_assemble.side_effect = fake_assemble

    # 1. auto_approve=true + metadata LLM parse failure
    # assert the video is NOT auto-published to YouTube, and the failure is recorded visibly
    mock_gen.side_effect = Exception("LLM crash")
    mock_upload.return_value = "yt_draft_123"

    db = MockDB()
    mock_session_local.return_value.__aenter__.return_value = db
    video = Video(id="vid1", script_id="script1", status=VideoStatus.rendering)
    channel = Channel(
        id="ch1",
        auto_approve=True,
        title_style_preference="curiosity",
        niche="science_wow",
    )
    profile = User(id="user1")
    idea = Idea(title="test idea", channel_id="ch1")
    db.added.append(video)
    db.added.append(channel)
    db.added.append(idea)
    db.added.append(profile)

    from backend.models.models import Script

    script = Script(id="script1", visual_prompts=["v1", "v2"], idea_id="idea1")

    # We must patch get() to return these based on type
    async def mock_get(model, id):
        if model == Video:
            return video
        if model == Channel:
            return channel
        if model == User:
            return profile
        if model == Idea:
            return idea
        if model == Script:
            return script
        return None

    db.get = mock_get

    from backend.services.rendering_service import run_job

    await run_job("vid1", MockRenderJob())

    assert "Metadata generation failed: LLM crash" in video.notes
    assert video.status == VideoStatus.ready  # Stays ready, NOT uploaded/live

    # Check that publication is still created as draft
    pubs = [p for p in db.added if type(p).__name__ == "Publication"]
    assert len(pubs) == 1
    pub = pubs[0]
    assert pub.status == "draft"
    assert pub.privacy_status == "private"


@pytest.mark.asyncio
@patch("os.path.getsize", return_value=20000)
@patch("backend.services.rendering_service.async_fetch_clips", new_callable=AsyncMock)
@patch("backend.services.rendering_service.generate_voiceover", new_callable=AsyncMock)
@patch("backend.services.rendering_service.async_assemble_job", new_callable=AsyncMock)
@patch("integrations.youtube.uploader.upload_video", new_callable=AsyncMock)
@patch("backend.services.rendering_service.generate_with_fallback")
@patch("backend.services.rendering_service.AsyncSessionLocal")
async def test_metadata_success_auto_publish(
    mock_session_local,
    mock_gen,
    mock_upload,
    mock_assemble,
    mock_tts,
    mock_fetch,
    mock_getsize,
):
    mock_tts.return_value = {
        "audio_path": "a",
        "sub_path": "s",
        "duration": 15.0,
        "voice": "v",
    }
    mock_fetch.return_value = [{"path": "clip1.mp4"}]

    from pathlib import Path

    async def fake_assemble(job):
        Path(job.output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(job.output_path).touch()

    mock_assemble.side_effect = fake_assemble

    # 2. auto_approve=true + metadata success
    # assert it IS auto-published.
    mock_gen.return_value = (
        '{"title_candidates": ["A"], "description": "B", "hashtags": ["C"]}',
        "mock_llm",
    )
    mock_upload.return_value = "yt_draft_123"

    db = MockDB()
    mock_session_local.return_value.__aenter__.return_value = db
    video = Video(id="vid1", script_id="script1", status=VideoStatus.rendering)
    channel = Channel(
        id="ch1",
        auto_approve=True,
        title_style_preference="curiosity",
        niche="science_wow",
    )
    profile = User(id="user1")
    idea = Idea(title="test idea", channel_id="ch1")

    from backend.models.models import Script

    script = Script(id="script1", visual_prompts=["v1", "v2"], idea_id="idea1")

    async def mock_get(model, id):
        if model == Video:
            return video
        if model == Channel:
            return channel
        if model == User:
            return profile
        if model == Idea:
            return idea
        if model == Script:
            return script
        return None

    db.get = mock_get

    from backend.services.rendering_service import run_job

    await run_job("vid1", MockRenderJob())

    assert video.status == VideoStatus.uploaded
    mock_upload.assert_called_once()

    pubs = [p for p in db.added if type(p).__name__ == "Publication"]
    assert len(pubs) == 1
    pub = pubs[0]
    assert pub.status == "live"
    assert pub.privacy_status == "public"


@pytest.mark.asyncio
@patch("backend.api.routes.ideas.fetch_trending_topics")
@patch("integrations.providers.ai_providers.generate_with_fallback")
async def test_pytrends_fails_idea_generation_proceeds(mock_gen, mock_trends):
    # 3. pytrends call fails/times out/returns empty
    # assert idea generation still proceeds but flags that trend data was unavailable
    mock_trends.side_effect = Exception("Pytrends timeout")
    mock_gen.return_value = (
        '{"ideas": [{"title": "t1", "angle": "a1", "score": 9.0}]}',
        "mock_llm",
    )

    from backend.api.routes.ideas import GenerateIdeasIn, generate_ideas

    db = MockDB()
    # Add a mock channel to the mock db
    channel = Channel(
        id="ch1", user_id="default-user", niche="test", niche_keywords=["test"]
    )

    async def mock_get(model, id):
        if model == Channel:
            return channel
        return None

    db.get = mock_get

    async def mock_scalar(stmt):
        return channel

    db.scalar = mock_scalar

    body = GenerateIdeasIn(channel_id="ch1", count=1, niche="test")
    user = User(id="default-user")

    res = await generate_ideas(body, user=user, db=db)

    assert len(res) == 1
    assert "Trend data unavailable" in res[0]["notes"]
    assert res[0]["status"] == IdeaStatus.pending.value


@pytest.mark.asyncio
@patch("os.path.getsize", return_value=20000)
@patch("backend.services.rendering_service.async_fetch_clips", new_callable=AsyncMock)
@patch("backend.services.rendering_service.generate_voiceover", new_callable=AsyncMock)
@patch("backend.services.rendering_service.async_assemble_job", new_callable=AsyncMock)
@patch("integrations.youtube.uploader.upload_video", new_callable=AsyncMock)
@patch("backend.services.rendering_service.generate_with_fallback")
@patch("backend.services.rendering_service.AsyncSessionLocal")
async def test_youtube_update_fails_adds_publish_failed_state(
    mock_session_local,
    mock_gen,
    mock_upload,
    mock_assemble,
    mock_tts,
    mock_fetch,
    mock_getsize,
):
    mock_tts.return_value = {
        "audio_path": "a",
        "sub_path": "s",
        "duration": 15.0,
        "voice": "v",
    }
    mock_fetch.return_value = [{"path": "clip1.mp4"}]

    from pathlib import Path

    async def fake_assemble(job):
        Path(job.output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(job.output_path).touch()

    mock_assemble.side_effect = fake_assemble

    # 4 & 5. YouTube upload fails (e.g. OAuth fail)
    # DB does not mark video as fully approved/published - adds distinct state publish_failed
    mock_gen.return_value = (
        '{"title_candidates": ["A"], "description": "B", "hashtags": ["C"]}',
        "mock_llm",
    )
    mock_upload.side_effect = Exception("OAuth Token Expired")

    db = MockDB()
    mock_session_local.return_value.__aenter__.return_value = db
    video = Video(id="vid1", script_id="script1", status=VideoStatus.rendering)
    channel = Channel(
        id="ch1",
        auto_approve=True,
        title_style_preference="curiosity",
        niche="science_wow",
    )
    profile = User(id="user1")
    idea = Idea(title="test idea", channel_id="ch1")

    from backend.models.models import Script

    script = Script(id="script1", visual_prompts=["v1", "v2"], idea_id="idea1")

    async def mock_get(model, id):
        if model == Video:
            return video
        if model == Channel:
            return channel
        if model == User:
            return profile
        if model == Idea:
            return idea
        if model == Script:
            return script
        return None

    db.get = mock_get

    from backend.services.rendering_service import run_job

    await run_job("vid1", MockRenderJob())

    assert video.status == VideoStatus.publish_failed
    assert "OAuth Token Expired" in video.notes

    pubs = [p for p in db.added if type(p).__name__ == "Publication"]
    assert len(pubs) == 1
    pub = pubs[0]
    assert pub.status == "draft"  # Stays draft because upload failed
    assert pub.privacy_status == "private"


@pytest.mark.asyncio
async def test_regenerate_used_script_rejected():
    from fastapi import HTTPException

    from backend.api.routes.scripts import regenerate_script
    from backend.models.models import Script, ScriptStatus

    db = MockDB()
    script = Script(
        id="used_script", idea_id="idea1", status=ScriptStatus.used_in_render
    )
    idea = Idea(id="idea1", title="test idea", channel_id="ch1")

    async def mock_get(model, id):
        if model == Script:
            return script
        if model == Idea:
            return idea
        return None

    db.get = mock_get

    with pytest.raises(HTTPException) as excinfo:
        await regenerate_script("used_script", user=User(id="default-user"), db=db)

    assert excinfo.value.status_code == 400
    assert "already used in a render" in excinfo.value.detail
