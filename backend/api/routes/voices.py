from fastapi import APIRouter

from engine.tts.voiceover import get_voice_catalog

router = APIRouter()


@router.get("/")
async def list_voices(language: str | None = None):
    """Get the catalog of available TTS voices."""
    return get_voice_catalog(language)
