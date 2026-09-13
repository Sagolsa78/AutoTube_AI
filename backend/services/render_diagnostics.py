import os
import shutil
import platform
import subprocess
from backend.services.media.encoder import select_video_encoder

def get_diagnostics() -> dict:
    """Return diagnostic data about the render environment."""
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    
    ffmpeg_version = "unknown"
    if ffmpeg_path:
        try:
            out = subprocess.check_output([ffmpeg_path, "-version"]).decode()
            ffmpeg_version = out.splitlines()[0]
        except Exception:
            pass

    encoder, _ = select_video_encoder()
    
    total, used, free = shutil.disk_usage("/")

    return {
        "os": platform.system(),
        "arch": platform.machine(),
        "ffmpeg": {
            "installed": bool(ffmpeg_path),
            "path": ffmpeg_path,
            "version": ffmpeg_version,
            "ffprobe_installed": bool(ffprobe_path),
        },
        "encoder": {
            "selected": encoder,
            "preference": os.getenv("VIDEO_ENCODER", "auto")
        },
        "disk": {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2)
        }
    }
