import asyncio
import json
import logging
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Tuple

import edge_tts

from integrations.providers.base import TTSProvider

log = logging.getLogger(__name__)

# edge-tts reports offsets/durations in 100-nanosecond ticks
_TICKS_PER_SEC = 10_000_000


class EdgeTTSProvider(TTSProvider):
    name = "edge_tts"

    def is_available(self) -> bool:
        return True  # Edge-TTS is a free library, always available

    async def _generate_tts(
        self,
        text: str,
        voice: str,
        audio_path: str,
    ) -> Tuple[float, List[Dict[str, Any]]]:
        communicate = edge_tts.Communicate(
            text,
            voice,
            boundary="WordBoundary",
        )
        word_boundaries: List[Dict[str, Any]] = []

        Path(audio_path).parent.mkdir(parents=True, exist_ok=True)

        with open(audio_path, "wb") as af:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    af.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    word_boundaries.append(
                        {
                            "text": chunk["text"],
                            "offset": chunk["offset"] / _TICKS_PER_SEC,
                            "duration": chunk["duration"] / _TICKS_PER_SEC,
                        }
                    )

        if not word_boundaries:
            log.warning(
                "edge-tts produced zero WordBoundary events. Generating fallback boundaries."
            )
            fallback_dur = 0.0
            if audio_path and Path(audio_path).exists():
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
                    fallback_dur = float(dur_out)
                except Exception:
                    fallback_dur = max(len(text.split()) * 0.4, 2.0)
            else:
                fallback_dur = max(len(text.split()) * 0.4, 2.0)

            words = text.split()
            if words and fallback_dur > 0:
                word_dur = fallback_dur / len(words)
                for i, w in enumerate(words):
                    word_boundaries.append(
                        {"text": w, "offset": i * word_dur, "duration": word_dur}
                    )
            return fallback_dur, word_boundaries

        last = word_boundaries[-1]
        duration = last["offset"] + last["duration"]
        return duration, word_boundaries

    async def generate_voiceover(
        self, text: str, voice: str, audio_path: str, language: str = "en"
    ) -> Dict[str, Any]:
        """Generate voiceover using Edge TTS."""
        max_retries = 3
        duration, word_boundaries = 0.0, []

        for attempt in range(max_retries):
            try:
                duration, word_boundaries = await asyncio.wait_for(
                    self._generate_tts(text, voice, audio_path), timeout=60.0
                )
                if duration > 0:
                    break
            except (asyncio.TimeoutError, Exception) as e:
                log.warning(f"Edge TTS attempt {attempt+1} failed: {e}")
                if attempt == max_retries - 1:
                    raise RuntimeError(
                        f"Edge TTS generation failed after {max_retries} attempts."
                    )
                await asyncio.sleep(2 * (attempt + 1))

        return {
            "duration": duration,
            "word_boundaries": word_boundaries,
            "voice": voice,
            "audio_path": audio_path,
        }
