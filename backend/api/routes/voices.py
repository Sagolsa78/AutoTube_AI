import os
import tempfile

import edge_tts
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import FileResponse

from engine.tts.voiceover import get_voice_catalog

router = APIRouter()


@router.get("/")
async def list_voices(language: str | None = None):
    """Get the catalog of available TTS voices."""
    return get_voice_catalog(language)


@router.get("/preview/{voice_id}")
async def preview_voice(voice_id: str, background_tasks: BackgroundTasks):
    """Generate a short audio preview for the selected voice."""
    catalog = get_voice_catalog()
    voice_info = next((v for v in catalog if v["id"] == voice_id), None)

    text = "Hello, this is a voice preview. I hope it sounds great!"
    if voice_info:
        if voice_info["language"] == "hi":
            text = "नमस्ते, यह एक आवाज़ का पूर्वावलोकन है। उम्मीद है यह अच्छा लग रहा है!"
        elif voice_info["language"] == "es":
            text = "Hola, esta es una vista previa de voz. ¡Espero que suene genial!"
        elif voice_info["language"] == "fr":
            text = "Bonjour, ceci est un aperçu vocal. J'espère que ça sonne bien !"
        elif voice_info["language"] == "de":
            text = "Hallo, dies ist eine Sprachvorschau. Ich hoffe, es klingt toll!"

    fd, path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)

    communicate = edge_tts.Communicate(text, voice_id)
    await communicate.save(path)

    background_tasks.add_task(os.remove, path)
    return FileResponse(
        path, media_type="audio/mpeg", filename=f"{voice_id}_preview.mp3"
    )
