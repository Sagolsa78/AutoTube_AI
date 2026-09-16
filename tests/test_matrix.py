import asyncio
import os
from pathlib import Path

import pytest

from backend.services.media.encoder import select_video_encoder
from engine.tts.voiceover import generate_voiceover


@pytest.mark.asyncio
async def test_encoder_fallback():
    encoder, is_hardware = select_video_encoder()
    assert encoder in ["libx264", "h264_nvenc"]


@pytest.mark.asyncio
async def test_voiceover_idempotency(tmp_path):
    audio_path = tmp_path / "voice.mp3"
    sub_path = tmp_path / "subs.ass"

    # First run
    res1 = await generate_voiceover(
        text="Hello world, this is a test.",
        niche="science_wow",
        audio_path=str(audio_path),
        sub_path=str(sub_path),
        language="en-US",
    )

    assert os.path.exists(res1["audio_path"])
    assert res1["duration"] > 0
    assert len(res1["word_boundaries"]) > 0

    # Second run (should be cached)
    res2 = await generate_voiceover(
        text="Hello world, this is a test.",
        niche="science_wow",
        audio_path=str(audio_path),
        sub_path=str(sub_path),
        language="en-US",
    )

    # The cached run uses ffprobe duration, which includes trailing silence
    # so it might be slightly longer than the sum of word boundaries
    assert abs(res2["duration"] - res1["duration"]) < 1.0
    assert len(res2["word_boundaries"]) == len(res1["word_boundaries"])
