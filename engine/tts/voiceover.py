"""
TTS engine — uses edge-tts with word-boundary events to generate
both the audio file and an ASS subtitle file with karaoke-style
per-word timing in one pass.
"""
from __future__ import annotations
import logging
from pathlib import Path

# pyrefly: ignore [missing-import]
import edge_tts

log = logging.getLogger(__name__)

# Recommended voices per niche
NICHE_VOICES: dict[str, str] = {
    "kids_facts":    "en-US-AnaNeural",     # warm, child-friendly
    "science_wow":   "en-US-GuyNeural",     # enthusiastic male
    "tech_mysteries":"en-GB-RyanNeural",    # British tech feel
}
DEFAULT_VOICE = "en-US-GuyNeural"

# edge-tts reports offsets/durations in 100-nanosecond ticks
_TICKS_PER_SEC = 10_000_000


async def _generate_tts(
    text: str,
    voice: str,
    audio_path: str,
) -> tuple[float, list[dict]]:
    """
    Stream audio to disk and capture per-word boundary events.
    Returns (duration_seconds, word_boundaries).
    Each boundary: {"text": str, "offset": float, "duration": float} in seconds.

    Raises RuntimeError if zero word-boundary events are captured —
    this means captions would be empty and we must not silently continue.
    """
    # CRITICAL: boundary="WordBoundary" — edge-tts >= 7.x defaults to
    # SentenceBoundary, which gives one event per sentence (useless for
    # per-word karaoke captions).  This was the root cause of empty SRTs.
    communicate = edge_tts.Communicate(
        text, voice, boundary="WordBoundary",
    )
    word_boundaries: list[dict] = []

    Path(audio_path).parent.mkdir(parents=True, exist_ok=True)

    with open(audio_path, "wb") as af:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                af.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                word_boundaries.append({
                    "text":     chunk["text"],
                    "offset":   chunk["offset"] / _TICKS_PER_SEC,
                    "duration": chunk["duration"] / _TICKS_PER_SEC,
                })

    if not word_boundaries:
        raise RuntimeError(
            "edge-tts produced zero WordBoundary events — cannot generate "
            "timed captions.  Check edge-tts version and voice availability."
        )

    last = word_boundaries[-1]
    duration = last["offset"] + last["duration"]
    log.info(
        "Captured %d word-boundary events (%.1fs total)",
        len(word_boundaries), duration,
    )
    return duration, word_boundaries


async def generate_voiceover(
    text: str,
    niche: str = "science_wow",
    audio_path: str = "storage/audio/voice.mp3",
    sub_path:   str = "storage/audio/subs.ass",
    voice: str | None = None,
) -> dict:
    """
    Generate voiceover and capture word-boundary timing data.
    The ASS subtitle file is generated later by the assembler (which knows
    the chosen caption style).  This function returns the raw word_boundaries
    so the assembler can build a correctly-styled ASS.

    Returns dict with audio_path, sub_path, duration, voice, word_boundaries.
    Raises RuntimeError if word-boundary capture fails.
    """
    selected_voice = voice or NICHE_VOICES.get(niche, DEFAULT_VOICE)
    log.info("Generating TTS with voice=%s", selected_voice)

    duration, word_boundaries = await _generate_tts(
        text, selected_voice, audio_path,
    )

    log.info("TTS complete: %.1fs audio → %s", duration, audio_path)
    return {
        "audio_path":      audio_path,
        "sub_path":        sub_path,
        "srt_path":        sub_path,          # backward-compat key
        "duration":        duration,
        "voice":           selected_voice,
        "word_boundaries": word_boundaries,
    }
