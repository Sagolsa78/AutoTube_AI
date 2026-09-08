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
    language: str = "en"
) -> dict:
    """
    Generate voiceover and capture word-boundary timing data.
    """
    # Simple language fallback map for Edge-TTS
    # Expanded language mapping, prioritizing specific locales
    LANG_VOICES = {
        "en-US": "en-US-GuyNeural",
        "en-IN": "en-IN-PrabhatNeural",
        "en-GB": "en-GB-RyanNeural",
        "es-ES": "es-ES-AlvaroNeural",
        "es": "es-ES-AlvaroNeural",
        "fr-FR": "fr-FR-HenriNeural",
        "fr": "fr-FR-HenriNeural",
        "de": "de-DE-KillianNeural",
        "it": "it-IT-DiegoNeural",
        "pt": "pt-BR-AntonioNeural",
        "hi-IN": "hi-IN-MadhurNeural",
        "hi": "hi-IN-MadhurNeural",
        "ja": "ja-JP-KeitaNeural",
        "ko": "ko-KR-InJoonNeural",
        "zh": "zh-CN-YunxiNeural",
    }
    
    # User selected voice or niche default
    selected_voice = voice or NICHE_VOICES.get(niche, DEFAULT_VOICE)
    
    # Extract lang base (e.g., "en" from "en-US")
    requested_lang_base = language.split("-")[0]
    voice_lang_base = selected_voice.split("-")[0]
    
    # If the voice's language doesn't match the requested language, override it
    # Edge-TTS cannot synthesize non-compatible language scripts (e.g., Hindi with an English voice)
    is_default = (voice is None) or (voice == NICHE_VOICES.get(niche)) or (voice == DEFAULT_VOICE)
    
    if requested_lang_base != voice_lang_base:
        fallback_voice = LANG_VOICES.get(language, LANG_VOICES.get(requested_lang_base))
        if fallback_voice:
            if not is_default:
                log.warning(
                    "Selected voice '%s' (%s) does not support requested language '%s'. "
                    "Switching to compatible voice '%s' to avoid TTS failure.",
                    selected_voice, voice_lang_base, language, fallback_voice
                )
            selected_voice = fallback_voice
    elif language == "en-IN" and is_default:
        # Specific override for Indian English if default is en-US
        selected_voice = LANG_VOICES["en-IN"]

    log.info("Generating TTS with voice=%s for language=%s", selected_voice, language)

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
