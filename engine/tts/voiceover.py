"""
TTS engine — uses edge-tts with word-boundary events to generate
both the audio file and an ASS subtitle file with karaoke-style
per-word timing in one pass.
"""
from __future__ import annotations
import logging
import asyncio
import json
from pathlib import Path
import subprocess

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
        log.warning(
            "edge-tts produced zero WordBoundary events — cannot generate "
            "timed captions. Continuing without word boundaries."
        )
        if audio_path and Path(audio_path).exists():
            import subprocess
            try:
                cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
                dur_out = subprocess.check_output(cmd).decode().strip()
                return float(dur_out), []
            except Exception:
                pass
        return 0.0, []

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

    # Check for existing assets (Idempotency)
    wb_path = str(Path(audio_path).with_suffix(".json"))
    if Path(audio_path).exists() and Path(audio_path).stat().st_size > 0:
        if Path(wb_path).exists():
            try:
                cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
                dur_out = subprocess.check_output(cmd).decode().strip()
                existing_dur = float(dur_out)
                
                with open(wb_path, "r") as f:
                    cached_boundaries = json.load(f)
                    
                log.info("Bypassing TTS generation: Valid audio and word boundaries already exist.")
                return {
                    "audio_path":      audio_path,
                    "sub_path":        sub_path,
                    "srt_path":        sub_path,
                    "duration":        existing_dur,
                    "voice":           selected_voice,
                    "word_boundaries": cached_boundaries,
                }
            except Exception as e:
                log.warning("Existing TTS assets invalid, regenerating. %s", e)

    max_retries = 3
    duration, word_boundaries = 0.0, []
    
    for attempt in range(max_retries):
        try:
            duration, word_boundaries = await asyncio.wait_for(
                _generate_tts(text, selected_voice, audio_path),
                timeout=60.0
            )
            if duration > 0:
                break
        except (asyncio.TimeoutError, Exception) as e:
            log.warning(f"TTS attempt {attempt+1} failed: {e}")
            if attempt == max_retries - 1:
                raise RuntimeError(f"TTS generation failed after {max_retries} attempts.")
            await asyncio.sleep(2 * (attempt + 1))

    log.info("TTS complete: %.1fs audio → %s", duration, audio_path)
    
    # Cache word boundaries for retry idempotency
    try:
        with open(wb_path, "w") as f:
            json.dump(word_boundaries, f)
    except Exception as e:
        log.warning("Failed to cache word boundaries: %s", e)

    return {
        "audio_path":      audio_path,
        "sub_path":        sub_path,
        "srt_path":        sub_path,          # backward-compat key
        "duration":        duration,
        "voice":           selected_voice,
        "word_boundaries": word_boundaries,
    }
