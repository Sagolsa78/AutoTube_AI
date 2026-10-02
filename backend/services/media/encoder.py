import os
import logging
import subprocess
from functools import lru_cache
from typing import Tuple, List

log = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def select_video_encoder() -> Tuple[str, List[str]]:
    """
    Selects the best available video encoder based on the VIDEO_ENCODER environment variable
    and actual hardware capabilities.
    Returns (codec, extra_args) for FFmpeg.
    """
    preference = os.getenv("VIDEO_ENCODER", "auto").lower()

    if preference == "cpu":
        log.info("VIDEO_ENCODER is set to 'cpu'. Using libx264.")
        return "libx264", ["-preset", "faster", "-crf", "23"]
    elif preference == "nvidia":
        log.info("VIDEO_ENCODER is set to 'nvidia'. Forcing h264_nvenc.")
        return "h264_nvenc", ["-preset", "p4", "-cq", "23", "-b:v", "0"]
    
    # Auto detection
    probe_cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "testsrc=duration=0.1:size=128x128:rate=1",
        "-c:v", "h264_nvenc",
        "-frames:v", "1",
        "-f", "null", "-"
    ]
    try:
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        if result.returncode == 0 and "error" not in result.stderr.lower():
            log.info("GPU encoder probe successful: h264_nvenc is functional.")
            return "h264_nvenc", ["-preset", "p4", "-cq", "23", "-b:v", "0"]
    except Exception as e:
        log.debug(f"GPU probe exception: {e}")

    log.info("GPU encoder unavailable or probe failed. Falling back to CPU libx264.")
    return "libx264", ["-preset", "faster", "-crf", "23"]
