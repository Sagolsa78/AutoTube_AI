#!/usr/bin/env python3
"""Validate local MP4 outputs without changing the source file."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOTS = [
    os.getenv("MEDIA_ROOT", ""),
    os.getenv("STORAGE_ROOT", ""),
    "storage",
    "media",
    "output",
]


def ffprobe(path: Path) -> dict:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_streams", "-show_format", "-of", "json", str(path)
    ]
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out)


def main() -> int:
    if shutil.which("ffprobe") is None:
        print("ffprobe not installed; skipping local MP4 sanity check")
        return 0

    seen = set()
    files = []
    for root in ROOTS:
        if not root:
            continue
        base = Path(root)
        if base.exists():
            for p in base.rglob("*.mp4"):
                if p not in seen:
                    seen.add(p)
                    files.append(p)

    if not files:
        print("No local MP4 files found; this is OK when final storage is remote (R2/S3).")
        return 0

    bad = 0
    for p in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True)[:20]:
        try:
            info = ffprobe(p)
            streams = info.get("streams", [])
            video = next((s for s in streams if s.get("codec_type") == "video"), None)
            audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
            fmt = info.get("format", {})
            print(
                f"[sanity] {p} size={p.stat().st_size} "
                f"format={fmt.get('format_name')} "
                f"video={video.get('codec_name') if video else None} "
                f"audio={audio.get('codec_name') if audio else None} "
                f"duration={fmt.get('duration')}"
            )
            if not video or video.get("codec_name") not in {"h264", "hevc", "vp9", "av1"}:
                bad += 1
        except Exception as exc:  # pragma: no cover - diagnostics only
            bad += 1
            print(f"[sanity] BAD {p}: {exc}")

    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
