import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from backend.models.models import Video, Idea, UserProfile, VideoStatus, Publication, IdeaStatus, Channel
from backend.api.routes.videos import _run_render

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
            return Idea(id="idea1", title="test idea", topic="test topic", channel_id="ch1")
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
                return MockScalars()
        return MockResult()

    async def refresh(self, obj):
        pass

class MockRenderJob:
    output_path = "/tmp/test.mp4"
    duration = 15.0
    script_full_text = "test script"
    niche = "science_wow"
    caption_style = "bold_centered"
    style = "realistic"
    watermark_path = None

@pytest.mark.asyncio
@patch("os.path.getsize", return_value=20000)
@patch("engine.visuals.fetcher.async_fetch_clips", new_callable=AsyncMock)
@patch("engine.tts.voiceover.generate_voiceover", new_callable=AsyncMock)
@patch("engine.rendering.assembler.async_assemble_job", new_callable=AsyncMock)
@patch("integrations.youtube.uploader.upload_video")
@patch("integrations.providers.ai_providers.generate_with_fallback")
@patch("backend.api.routes.videos.AsyncSessionLocal")
async def test_metadata_failure_no_auto_publish(mock_session_local, mock_gen, mock_upload, mock_assemble, mock_tts, mock_fetch, mock_getsize):
    mock_tts.return_value = {"audio_path": "a", "sub_path": "s", "duration": 15.0, "voice": "v"}
    mock_fetch.return_value = [{"path": "clip1.mp4"}]
    # 1. auto_approve=true + metadata LLM parse failure
    # assert the video is NOT auto-published to YouTube, and the failure is recorded visibly
    mock_gen.side_effect = Exception("LLM crash")
    mock_upload.return_value = "yt_draft_123"
    
    db = MockDB()
    mock_session_local.return_value.__aenter__.return_value = db
    video = Video(id="vid1", script_id="script1")
    profile = UserProfile(auto_approve=True, title_style_preference="curiosity")
    idea = Idea(title="test idea")
    db.added.append(video)
    db.added.append(profile)
    db.added.append(idea)
    
    from backend.models.models import Script
    script = Script(id="script1", visual_prompts=["v1", "v2"])
    
    # We must patch get() to return these based on type
    async def mock_get(model, id):
        if model == Video: return video
        if model == UserProfile: return profile
        if model == Idea: return idea
        if model == Script: return script
        return None
    db.get = mock_get
    
    await _run_render("vid1", MockRenderJob())
    
    assert "Metadata generation failed: LLM crash" in video.notes
    assert video.status == VideoStatus.ready # Stays ready, NOT uploaded/live
    
    # Check that publication is still created as draft
    pubs = [p for p in db.added if type(p).__name__ == "Publication"]
    assert len(pubs) == 1
    pub = pubs[0]
    assert pub.status == "draft"
    assert pub.privacy_status == "private"


@pytest.mark.asyncio
@patch("os.path.getsize", return_value=20000)
@patch("engine.visuals.fetcher.async_fetch_clips", new_callable=AsyncMock)
@patch("engine.tts.voiceover.generate_voiceover", new_callable=AsyncMock)
@patch("engine.rendering.assembler.async_assemble_job", new_callable=AsyncMock)
@patch("integrations.youtube.uploader.upload_video")
@patch("integrations.providers.ai_providers.generate_with_fallback")
@patch("backend.api.routes.videos.AsyncSessionLocal")
async def test_metadata_success_auto_publish(mock_session_local, mock_gen, mock_upload, mock_assemble, mock_tts, mock_fetch, mock_getsize):
    mock_tts.return_value = {"audio_path": "a", "sub_path": "s", "duration": 15.0, "voice": "v"}
    mock_fetch.return_value = [{"path": "clip1.mp4"}]
    # 2. auto_approve=true + metadata success
    # assert it IS auto-published.
    mock_gen.return_value = ('{"title_candidates": ["A"], "description": "B", "hashtags": ["C"]}', "mock_llm")
    mock_upload.return_value = "yt_draft_123"
    
    db = MockDB()
    mock_session_local.return_value.__aenter__.return_value = db
    video = Video(id="vid1", script_id="script1")
    profile = UserProfile(auto_approve=True, title_style_preference="curiosity")
    idea = Idea(title="test idea")
    
    from backend.models.models import Script
    script = Script(id="script1", visual_prompts=["v1", "v2"])
    
    async def mock_get(model, id):
        if model == Video: return video
        if model == UserProfile: return profile
        if model == Idea: return idea
        if model == Script: return script
        return None
    db.get = mock_get
    
    with patch("googleapiclient.discovery.build") as mock_build:
        mock_youtube = MagicMock()
        mock_build.return_value = mock_youtube
        
        with patch("integrations.youtube.uploader._get_credentials"):
            await _run_render("vid1", MockRenderJob())
            
            assert video.status == VideoStatus.uploaded
            
            # YouTube update was called
            mock_youtube.videos().update.assert_called_once()
            
            pubs = [p for p in db.added if type(p).__name__ == "Publication"]
            assert len(pubs) == 1
            pub = pubs[0]
            assert pub.status == "live"
            assert pub.privacy_status == "public"


@pytest.mark.asyncio
@patch("backend.api.routes.ideas.fetch_trending_topics")
@patch("backend.api.routes.ideas._ensure_profile", new_callable=AsyncMock)
@patch("integrations.providers.ai_providers.generate_with_fallback")
async def test_pytrends_fails_idea_generation_proceeds(mock_gen, mock_ensure_profile, mock_trends):
    # 3. pytrends call fails/times out/returns empty
    # assert idea generation still proceeds but flags that trend data was unavailable
    mock_trends.side_effect = Exception("Pytrends timeout")
    mock_ensure_profile.return_value = UserProfile(niche_keywords=["test"])
    mock_gen.return_value = ('{"ideas": [{"title": "t1", "angle": "a1", "score": 9.0}]}', "mock_llm")
    
    from backend.api.routes.ideas import generate_ideas, GenerateIdeasIn
    db = MockDB()
    body = GenerateIdeasIn(channel_id="ch1", count=1, niche="test")
    
    res = await generate_ideas(body, db)
    
    assert len(res) == 1
    assert "Trend data unavailable" in res[0]["notes"]
    assert res[0]["status"] == IdeaStatus.pending.value


@pytest.mark.asyncio
@patch("os.path.getsize", return_value=20000)
@patch("engine.visuals.fetcher.async_fetch_clips", new_callable=AsyncMock)
@patch("engine.tts.voiceover.generate_voiceover", new_callable=AsyncMock)
@patch("engine.rendering.assembler.async_assemble_job", new_callable=AsyncMock)
@patch("integrations.youtube.uploader.upload_video")
@patch("integrations.providers.ai_providers.generate_with_fallback")
@patch("backend.api.routes.videos.AsyncSessionLocal")
async def test_youtube_update_fails_adds_publish_failed_state(mock_session_local, mock_gen, mock_upload, mock_assemble, mock_tts, mock_fetch, mock_getsize):
    mock_tts.return_value = {"audio_path": "a", "sub_path": "s", "duration": 15.0, "voice": "v"}
    mock_fetch.return_value = [{"path": "clip1.mp4"}]
    # 4 & 5. YouTube draft upload succeeds, but videos.update() fails (e.g. OAuth fail)
    # DB does not mark video as fully approved/published - adds distinct state publish_failed
    mock_gen.return_value = ('{"title_candidates": ["A"], "description": "B", "hashtags": ["C"]}', "mock_llm")
    mock_upload.return_value = "yt_draft_123"
    
    db = MockDB()
    mock_session_local.return_value.__aenter__.return_value = db
    video = Video(id="vid1", script_id="script1")
    profile = UserProfile(auto_approve=True, title_style_preference="curiosity")
    idea = Idea(title="test idea")
    
    from backend.models.models import Script
    script = Script(id="script1", visual_prompts=["v1", "v2"])
    
    async def mock_get(model, id):
        if model == Video: return video
        if model == UserProfile: return profile
        if model == Idea: return idea
        if model == Script: return script
        return None
    db.get = mock_get
    
    with patch("googleapiclient.discovery.build") as mock_build:
        mock_youtube = MagicMock()
        # Simulate OAuth failure / Update failure
        mock_youtube.videos().update.side_effect = Exception("OAuth Token Expired")
        mock_build.return_value = mock_youtube
        
        with patch("integrations.youtube.uploader._get_credentials"):
            await _run_render("vid1", MockRenderJob())
            
            assert video.status == VideoStatus.publish_failed
            assert "OAuth Token Expired" in video.notes
            
            pubs = [p for p in db.added if type(p).__name__ == "Publication"]
            assert len(pubs) == 1
            pub = pubs[0]
            assert pub.status == "draft" # Stays draft because update failed
            assert pub.privacy_status == "private"


@pytest.mark.asyncio
async def test_regenerate_used_script_rejected():
    from backend.api.routes.scripts import regenerate_script
    from backend.models.models import Script, ScriptStatus
    from fastapi import HTTPException
    
    db = MockDB()
    script = Script(id="used_script", idea_id="idea1", status=ScriptStatus.used_in_render)
    
    async def mock_get(model, id):
        if model == Script: return script
        return None
    db.get = mock_get
    
    with pytest.raises(HTTPException) as excinfo:
        await regenerate_script("used_script", db)
        
    assert excinfo.value.status_code == 400
    assert "already used in a render" in excinfo.value.detail
