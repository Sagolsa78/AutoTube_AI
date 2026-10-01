"""
TTS engine — uses edge-tts with word-boundary events to generate
both the audio file and an ASS subtitle file with karaoke-style
per-word timing in one pass.
"""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess
from pathlib import Path

from integrations.providers.tts.edge_tts_provider import EdgeTTSProvider

log = logging.getLogger(__name__)

# Recommended voices per niche
NICHE_VOICES: dict[str, str] = {
    "kids_facts": "en-US-AnaNeural",  # warm, child-friendly
    "science_wow": "en-US-GuyNeural",  # enthusiastic male
    "tech_mysteries": "en-GB-RyanNeural",  # British tech feel
}
DEFAULT_VOICE = "en-US-GuyNeural"

# Full catalog of supported voices with metadata for the UI
VOICE_CATALOG = [
    # ── English (US) ──────────────────────────────────────────────────────────
    {
        "id": "en-US-GuyNeural",
        "name": "Guy",
        "language": "en",
        "locale": "en-US",
        "gender": "Male",
        "description": "Natural, enthusiastic male — great for narrations",
    },
    {
        "id": "en-US-AnaNeural",
        "name": "Ana",
        "language": "en",
        "locale": "en-US",
        "gender": "Female",
        "description": "Warm, child-friendly female",
    },
    {
        "id": "en-US-ChristopherNeural",
        "name": "Christopher",
        "language": "en",
        "locale": "en-US",
        "gender": "Male",
        "description": "Reliable, clear male — ideal for tutorials",
    },
    {
        "id": "en-US-AriaNeural",
        "name": "Aria",
        "language": "en",
        "locale": "en-US",
        "gender": "Female",
        "description": "Professional female — perfect for explainers",
    },
    # ── Multilingual (support Hindi, English, and many more) ──────────────────
    {
        "id": "en-US-AndrewMultilingualNeural",
        "name": "Andrew (Multilingual)",
        "language": "multi",
        "locale": "en-US",
        "gender": "Male",
        "description": "Fluent in Hindi, English & 10+ languages — deep, engaging male",
        "tags": ["hindi", "multilingual", "premium"],
    },
    {
        "id": "en-US-AvaMultilingualNeural",
        "name": "Ava (Multilingual)",
        "language": "multi",
        "locale": "en-US",
        "gender": "Female",
        "description": "Fluent in Hindi, English & 10+ languages — warm, expressive female",
        "tags": ["hindi", "multilingual", "premium"],
    },
    {
        "id": "en-US-BrianMultilingualNeural",
        "name": "Brian (Multilingual)",
        "language": "multi",
        "locale": "en-US",
        "gender": "Male",
        "description": "Fluent in Hindi, English & 10+ languages — authoritative male",
        "tags": ["hindi", "multilingual", "premium"],
    },
    {
        "id": "en-US-EmmaMultilingualNeural",
        "name": "Emma (Multilingual)",
        "language": "multi",
        "locale": "en-US",
        "gender": "Female",
        "description": "Fluent in Hindi, English & 10+ languages — friendly, natural female",
        "tags": ["hindi", "multilingual", "premium"],
    },
    # ── English (British) ─────────────────────────────────────────────────────
    {
        "id": "en-GB-RyanNeural",
        "name": "Ryan",
        "language": "en",
        "locale": "en-GB",
        "gender": "Male",
        "description": "British tech feel — cool and authoritative",
    },
    {
        "id": "en-GB-SoniaNeural",
        "name": "Sonia",
        "language": "en",
        "locale": "en-GB",
        "gender": "Female",
        "description": "Clear British female — polished delivery",
    },
    # ── English (Indian) ──────────────────────────────────────────────────────
    {
        "id": "en-IN-PrabhatNeural",
        "name": "Prabhat",
        "language": "en",
        "locale": "en-IN",
        "gender": "Male",
        "description": "Indian English male — natural desi accent",
    },
    {
        "id": "en-IN-NeerjaNeural",
        "name": "Neerja",
        "language": "en",
        "locale": "en-IN",
        "gender": "Female",
        "description": "Indian English female — clear and professional",
    },
    {
        "id": "en-IN-NeerjaExpressiveNeural",
        "name": "Neerja (Expressive)",
        "language": "en",
        "locale": "en-IN",
        "gender": "Female",
        "description": "Expressive Indian English female — animated storytelling",
    },
    # ── Hindi ─────────────────────────────────────────────────────────────────
    {
        "id": "hi-IN-MadhurNeural",
        "name": "Madhur",
        "language": "hi",
        "locale": "hi-IN",
        "gender": "Male",
        "description": "Natural Hindi male — warm and engaging voice",
        "tags": ["hindi", "native"],
    },
    {
        "id": "hi-IN-SwaraNeural",
        "name": "Swara",
        "language": "hi",
        "locale": "hi-IN",
        "gender": "Female",
        "description": "Natural Hindi female — smooth and expressive",
        "tags": ["hindi", "native"],
    },
    # ── Indian Regional Languages ─────────────────────────────────────────────
    {
        "id": "bn-IN-BashkarNeural",
        "name": "Bashkar",
        "language": "bn",
        "locale": "bn-IN",
        "gender": "Male",
        "description": "Bengali male — clear and articulate",
        "tags": ["bengali", "indian"],
    },
    {
        "id": "bn-IN-TanishaaNeural",
        "name": "Tanishaa",
        "language": "bn",
        "locale": "bn-IN",
        "gender": "Female",
        "description": "Bengali female — warm and natural",
        "tags": ["bengali", "indian"],
    },
    {
        "id": "gu-IN-DhwaniNeural",
        "name": "Dhwani",
        "language": "gu",
        "locale": "gu-IN",
        "gender": "Female",
        "description": "Gujarati female — pleasant and clear",
        "tags": ["gujarati", "indian"],
    },
    {
        "id": "gu-IN-NiranjanNeural",
        "name": "Niranjan",
        "language": "gu",
        "locale": "gu-IN",
        "gender": "Male",
        "description": "Gujarati male — confident and steady",
        "tags": ["gujarati", "indian"],
    },
    {
        "id": "mr-IN-AarohiNeural",
        "name": "Aarohi",
        "language": "mr",
        "locale": "mr-IN",
        "gender": "Female",
        "description": "Marathi female — lively and expressive",
        "tags": ["marathi", "indian"],
    },
    {
        "id": "mr-IN-ManoharNeural",
        "name": "Manohar",
        "language": "mr",
        "locale": "mr-IN",
        "gender": "Male",
        "description": "Marathi male — deep and resonant",
        "tags": ["marathi", "indian"],
    },
    {
        "id": "ta-IN-PallaviNeural",
        "name": "Pallavi",
        "language": "ta",
        "locale": "ta-IN",
        "gender": "Female",
        "description": "Tamil female — melodic and clear",
        "tags": ["tamil", "indian"],
    },
    {
        "id": "ta-IN-ValluvarNeural",
        "name": "Valluvar",
        "language": "ta",
        "locale": "ta-IN",
        "gender": "Male",
        "description": "Tamil male — authoritative narrator",
        "tags": ["tamil", "indian"],
    },
    {
        "id": "te-IN-ShrutiNeural",
        "name": "Shruti",
        "language": "te",
        "locale": "te-IN",
        "gender": "Female",
        "description": "Telugu female — soft and pleasant",
        "tags": ["telugu", "indian"],
    },
    {
        "id": "te-IN-MohanNeural",
        "name": "Mohan",
        "language": "te",
        "locale": "te-IN",
        "gender": "Male",
        "description": "Telugu male — clear and steady",
        "tags": ["telugu", "indian"],
    },
    {
        "id": "ur-IN-GulNeural",
        "name": "Gul",
        "language": "ur",
        "locale": "ur-IN",
        "gender": "Female",
        "description": "Urdu female — elegant and poetic",
        "tags": ["urdu", "indian"],
    },
    {
        "id": "ur-IN-SalmanNeural",
        "name": "Salman",
        "language": "ur",
        "locale": "ur-IN",
        "gender": "Male",
        "description": "Urdu male — rich and expressive",
        "tags": ["urdu", "indian"],
    },
    # ── Spanish ───────────────────────────────────────────────────────────────
    {
        "id": "es-ES-AlvaroNeural",
        "name": "Alvaro",
        "language": "es",
        "locale": "es-ES",
        "gender": "Male",
        "description": "Spanish male — warm and conversational",
    },
    {
        "id": "es-ES-ElviraNeural",
        "name": "Elvira",
        "language": "es",
        "locale": "es-ES",
        "gender": "Female",
        "description": "Spanish female — clear and professional",
    },
    # ── French ────────────────────────────────────────────────────────────────
    {
        "id": "fr-FR-HenriNeural",
        "name": "Henri",
        "language": "fr",
        "locale": "fr-FR",
        "gender": "Male",
        "description": "French male — smooth and sophisticated",
    },
    {
        "id": "fr-FR-DeniseNeural",
        "name": "Denise",
        "language": "fr",
        "locale": "fr-FR",
        "gender": "Female",
        "description": "French female — elegant and natural",
    },
    # ── German ────────────────────────────────────────────────────────────────
    {
        "id": "de-DE-KillianNeural",
        "name": "Killian",
        "language": "de",
        "locale": "de-DE",
        "gender": "Male",
        "description": "German male — precise and authoritative",
    },
    {
        "id": "de-DE-AmalaNeural",
        "name": "Amala",
        "language": "de",
        "locale": "de-DE",
        "gender": "Female",
        "description": "German female — clear and professional",
    },
]


def get_voice_catalog(language: str | None = None) -> list[dict]:
    """Return the catalog of available voices, optionally filtered by language.
    Multilingual voices are always included when filtering by any language,
    since they support Hindi, English, and 10+ languages natively.
    """
    if language:
        lang_base = language.split("-")[0]
        return [
            v
            for v in VOICE_CATALOG
            if v["language"] == lang_base or v["language"] == "multi"
        ]
    return VOICE_CATALOG


def get_tts_provider() -> EdgeTTSProvider:
    """Factory to get the configured TTS Provider. Defaults to EdgeTTS."""
    return EdgeTTSProvider()


async def generate_voiceover(
    text: str,
    niche: str = "science_wow",
    audio_path: str = "storage/audio/voice.mp3",
    sub_path: str = "storage/audio/subs.ass",
    voice: str | None = None,
    language: str = "en",
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
        "bn": "bn-IN-BashkarNeural",
        "gu": "gu-IN-NiranjanNeural",
        "mr": "mr-IN-ManoharNeural",
        "ta": "ta-IN-ValluvarNeural",
        "te": "te-IN-MohanNeural",
        "ur": "ur-IN-SalmanNeural",
        "ja": "ja-JP-KeitaNeural",
        "ko": "ko-KR-InJoonNeural",
        "zh": "zh-CN-YunxiNeural",
    }

    # User selected voice or niche default
    selected_voice = voice or NICHE_VOICES.get(niche, DEFAULT_VOICE)

    # Multilingual voices can handle any language — skip language-mismatch overrides
    is_multilingual = "Multilingual" in selected_voice

    # Extract lang base (e.g., "en" from "en-US")
    requested_lang_base = language.split("-")[0]
    voice_lang_base = selected_voice.split("-")[0]

    # If the voice's language doesn't match the requested language, override it
    # Edge-TTS cannot synthesize non-compatible language scripts (e.g., Hindi with an English voice)
    # Exception: multilingual voices can handle any language natively
    is_default = (
        (voice is None)
        or (voice == NICHE_VOICES.get(niche))
        or (voice == DEFAULT_VOICE)
    )

    if not is_multilingual and requested_lang_base != voice_lang_base:
        fallback_voice = LANG_VOICES.get(language, LANG_VOICES.get(requested_lang_base))
        if fallback_voice:
            if not is_default:
                log.warning(
                    "Selected voice '%s' (%s) does not support requested language '%s'. "
                    "Switching to compatible voice '%s' to avoid TTS failure.",
                    selected_voice,
                    voice_lang_base,
                    language,
                    fallback_voice,
                )
            selected_voice = fallback_voice
    elif not is_multilingual and language == "en-IN" and is_default:
        # Specific override for Indian English if default is en-US
        selected_voice = LANG_VOICES["en-IN"]

    log.info("Generating TTS with voice=%s for language=%s", selected_voice, language)

    # Check for existing assets (Idempotency)
    wb_path = str(Path(audio_path).with_suffix(".json"))
    if Path(audio_path).exists() and Path(audio_path).stat().st_size > 0:
        if Path(wb_path).exists():
            try:
                cmd = [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    audio_path,
                ]
                dur_out = subprocess.check_output(cmd).decode().strip()
                existing_dur = float(dur_out)

                with open(wb_path, "r") as f:
                    cached_boundaries = json.load(f)

                log.info(
                    "Bypassing TTS generation: Valid audio and word boundaries already exist."
                )
                return {
                    "audio_path": audio_path,
                    "sub_path": sub_path,
                    "srt_path": sub_path,
                    "duration": existing_dur,
                    "voice": selected_voice,
                    "word_boundaries": cached_boundaries,
                }
            except Exception as e:
                log.warning("Existing TTS assets invalid, regenerating. %s", e)

    provider = get_tts_provider()

    result = await provider.generate_voiceover(
        text=text, voice=selected_voice, audio_path=audio_path, language=language
    )

    duration = result["duration"]
    word_boundaries = result["word_boundaries"]

    log.info("TTS complete: %.1fs audio → %s", duration, audio_path)

    # Cache word boundaries for retry idempotency
    try:
        with open(wb_path, "w") as f:
            json.dump(word_boundaries, f)
    except Exception as e:
        log.warning("Failed to cache word boundaries: %s", e)

    cost_data = {
        "provider": "edge_tts",
        "model": selected_voice,
        "units": len(text),  # Character count
        "estimated_cost": 0.0,  # Free
    }

    return {
        "audio_path": audio_path,
        "sub_path": sub_path,
        "srt_path": sub_path,  # backward-compat key
        "duration": duration,
        "voice": selected_voice,
        "word_boundaries": word_boundaries,
        "cost_data": cost_data,
    }
