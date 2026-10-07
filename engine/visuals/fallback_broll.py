import asyncio
import logging
import os
import uuid
from pathlib import Path

from backend.core.config import settings

log = logging.getLogger(__name__)


async def generate_fallback_broll(prompt: str, out_dir: str | Path) -> str | None:
    """
    Synthesizes a quick 3-second video using an AI Video API (e.g., Fal.ai, Luma, Runway Gen-2)
    when stock search fails.

    This function currently simulates the API call and generates a placeholder
    video with ffmpeg to represent the AI-generated B-roll.
    """
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    clip_path = out_path / f"ai_broll_{uuid.uuid4().hex[:8]}.mp4"

    log.info(f"Generating fallback AI B-roll for prompt: '{prompt}'")

    # Simulate API latency for AI generation
    await asyncio.sleep(2)

    # In a real implementation, you would call:
    # client = FalAIClient(api_key=settings.FAL_API_KEY)
    # url = await client.generate_video(prompt=prompt, duration=3)
    # download_to(url, clip_path)

    # Simulated generation: use ffmpeg to create a 3-second clip with text
    safe_prompt = prompt.replace("'", "").replace(":", "")[:30] + "..."
    text_overlay = f"AI B-Roll:\\n{safe_prompt}"

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=navy:s=1080x1920:d=3",
        "-vf",
        f"drawtext=text='{text_overlay}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        str(clip_path),
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            log.error(f"Fallback generation ffmpeg failed: {stderr.decode()}")
            return None

        log.info(f"Fallback AI B-roll generated at {clip_path}")
        return str(clip_path)

    except Exception as e:
        log.error(f"Failed to generate fallback AI B-roll: {e}")
        return None
