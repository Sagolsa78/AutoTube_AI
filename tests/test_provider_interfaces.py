from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.models.models import Job
from backend.services.asset_service import execute_asset_job
from engine.tts.voiceover import generate_voiceover
from integrations.providers.base import LLMProvider, TTSProvider, VisualProvider


# Mock providers
class MockVisualProvider(VisualProvider):
    name = "mock_visual"

    def is_available(self) -> bool:
        return True

    async def generate_image(self, prompt: str, out_dir: str) -> str:
        return f"{out_dir}/mock_image.png"

    async def generate_video(self, prompt: str, out_dir: str) -> str:
        return f"{out_dir}/mock_video.mp4"


class MockTTSProvider(TTSProvider):
    name = "mock_tts"

    def is_available(self) -> bool:
        return True

    async def generate_voiceover(
        self, text: str, voice: str, audio_path: str, language: str = "en"
    ) -> dict:
        return {
            "duration": 1.5,
            "word_boundaries": [{"text": text, "offset": 0, "duration": 1.5}],
            "voice": voice,
            "audio_path": audio_path,
        }


@pytest.mark.asyncio
async def test_asset_service_uses_visual_provider(monkeypatch):
    monkeypatch.setattr(
        "backend.services.asset_service.get_visual_provider",
        lambda: MockVisualProvider(),
    )

    # Mock DB and Job
    mock_job = Job(
        id="123", user_id="user1", payload={"prompt": "test prompt", "mode": "IMAGE"}
    )

    mock_db = AsyncMock()
    mock_db.get.return_value = mock_job

    mock_session_local = MagicMock()
    mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "backend.services.asset_service.AsyncSessionLocal", mock_session_local
    )

    # Mock storage
    mock_storage = AsyncMock()
    mock_storage.put_file.return_value = "https://mock.url/image.png"
    monkeypatch.setattr("backend.services.asset_service.storage", mock_storage)

    # Mock Path.exists so the validation passes
    mock_path = MagicMock()
    mock_path.exists.return_value = True
    mock_path.name = "mock_image.png"

    # We need to mock pathlib.Path in asset_service, but Path is also instantiated for local_path
    # A simpler way is to mock it via monkeypatch
    original_path = __import__("pathlib").Path

    def fake_path(*args, **kwargs):
        if str(args[0]).endswith("mock_image.png"):
            return mock_path
        return original_path(*args, **kwargs)

    monkeypatch.setattr("backend.services.asset_service.Path", fake_path)

    success = await execute_asset_job("123")
    assert success is True

    # Verify the job result has the mock URL
    assert mock_job.result["url"] == "https://mock.url/image.png"


@pytest.mark.asyncio
async def test_voiceover_uses_tts_provider(monkeypatch):
    monkeypatch.setattr(
        "engine.tts.voiceover.get_tts_provider", lambda: MockTTSProvider()
    )

    # Needs to bypass file caching check by mocking Path.exists
    mock_path = MagicMock()
    mock_path.exists.return_value = False
    monkeypatch.setattr("engine.tts.voiceover.Path", MagicMock(return_value=mock_path))

    result = await generate_voiceover(text="Hello world", audio_path="mock.mp3")

    assert result["duration"] == 1.5
    assert len(result["word_boundaries"]) == 1
    assert result["audio_path"] == "mock.mp3"
