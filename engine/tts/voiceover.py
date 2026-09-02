"""
TTS engine — uses edge-tts with word-boundary events to generate
both the audio file and an SRT subtitle file in one pass.
"""
from __future__ import annotations
import asyncio
import logging
import os
from pathlib import Path

import edge_tts

log = logging.getLogger(__name__)

# Recommended voices per niche
NICHE_VOICES: dict[str, str] = {
    "kids_facts":    "en-US-AnaNeural",     # warm, child-friendly
    "science_wow":   "en-US-GuyNeural",     # enthusiastic male
    "tech_mysteries":"en-GB-RyanNeural",    # British tech feel
}
DEFAULT_VOICE = "en-US-GuyNeural"


async def _generate_tts(
    text: str,
    voice: str,
    audio_path: str,
    srt_path: str,
) -> float:
    """
    Internal async generator.
    Returns the estimated duration in seconds based on word count.
    """
    communicate = edge_tts.Communicate(text, voice)
    submaker    = edge_tts.SubMaker()

    Path(audio_path).parent.mkdir(parents=True, exist_ok=True)
    Path(srt_path).parent.mkdir(parents=True, exist_ok=True)

    with open(audio_path, "wb") as af:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                af.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)

    srt_text = submaker.get_srt()
    if not srt_text.strip():
        # FFmpeg crashes if the SRT file is completely empty.
        srt_text = "1\n00:00:00,000 --> 00:00:01,000\n \n"
        
    with open(srt_path, "w", encoding="utf-8") as sf:
        sf.write(srt_text)

    # Estimate duration from SRT (last timestamp)
    duration = _parse_srt_duration(srt_text)
    return duration


def _parse_srt_duration(srt: str) -> float:
    """Extract end time of last SRT block as seconds."""
    import re
    times = re.findall(r"(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})", srt)
    if not times:
        return 40.0
    last_end = times[-1][1]  # HH:MM:SS,mmm
    h, m, rest = last_end.split(":")
    s, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


async def generate_voiceover(
    text: str,
    niche: str = "science_wow",
    audio_path: str = "storage/audio/voice.mp3",
    srt_path:   str = "storage/audio/subs.srt",
    voice: str | None = None,
) -> dict:
    """
    Generate voiceover and subtitles.
    Returns dict with audio_path, srt_path, duration, voice.
    """
    selected_voice = voice or NICHE_VOICES.get(niche, DEFAULT_VOICE)
    log.info("Generating TTS with voice=%s", selected_voice)

    duration = await _generate_tts(text, selected_voice, audio_path, srt_path)

    log.info("TTS complete: %.1fs audio → %s", duration, audio_path)
    return {
        "audio_path": audio_path,
        "srt_path":   srt_path,
        "duration":   duration,
        "voice":      selected_voice,
    }
