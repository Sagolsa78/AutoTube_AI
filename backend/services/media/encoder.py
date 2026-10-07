import logging
import os
import subprocess
from functools import lru_cache
from typing import List, Tuple

log = logging.getLogger(__name__)


def select_video_encoder(quality: str = "standard") -> Tuple[str, List[str]]:
    """
    Selects the best available video encoder based on the VIDEO_ENCODER environment variable
    and actual hardware capabilities.
    Returns (codec, extra_args) for FFmpeg.
    """
    preference = os.getenv("VIDEO_ENCODER", "auto").lower()

    preset_map = {
        "draft": {
            "cpu_preset": "ultrafast",
            "cpu_crf": "28",
            "gpu_cq": "30",
            "gpu_preset": "p1",
        },
        "standard": {
            "cpu_preset": "faster",
            "cpu_crf": "23",
            "gpu_cq": "23",
            "gpu_preset": "p4",
        },
        "high": {
            "cpu_preset": "medium",
            "cpu_crf": "18",
            "gpu_cq": "18",
            "gpu_preset": "p6",
        },
        "ultra": {
            "cpu_preset": "slow",
            "cpu_crf": "15",
            "gpu_cq": "15",
            "gpu_preset": "p7",
        },
    }
    settings = preset_map.get(quality, preset_map["standard"])

    if preference == "cpu":
        log.info("VIDEO_ENCODER is set to 'cpu'. Using libx264.")
        return "libx264", [
            "-preset",
            settings["cpu_preset"],
            "-crf",
            settings["cpu_crf"],
        ]
    elif preference == "nvidia":
        log.info("VIDEO_ENCODER is set to 'nvidia'. Forcing h264_nvenc.")
        return "h264_nvenc", [
            "-preset",
            settings["gpu_preset"],
            "-cq",
            settings["gpu_cq"],
            "-b:v",
            "0",
        ]

    # Auto detection
    probe_cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=0.1:size=128x128:rate=1",
        "-c:v",
        "h264_nvenc",
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
    ]
    try:
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        if result.returncode == 0 and "error" not in result.stderr.lower():
            log.info("GPU encoder probe successful: h264_nvenc is functional.")
            return "h264_nvenc", [
                "-preset",
                settings["gpu_preset"],
                "-cq",
                settings["gpu_cq"],
                "-b:v",
                "0",
            ]
    except Exception as e:
        log.debug(f"GPU probe exception: {e}")

    log.info("GPU encoder unavailable or probe failed. Falling back to CPU libx264.")
    return "libx264", ["-preset", settings["cpu_preset"], "-crf", settings["cpu_crf"]]
