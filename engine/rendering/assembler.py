"""
Video assembly — stitches clips, burns styled captions, overlays watermark,
mixes audio using FFmpeg.  Output: 1080×1920 MP4, H.264/AAC, 30fps.
"""
from __future__ import annotations
import logging
import os
import subprocess
import uuid
from pathlib import Path

from backend.settings import RENDER_DIR
from engine.captions.styles import build_karaoke_ass
from engine.models import RenderJob

log = logging.getLogger(__name__)

TARGET_W = 1080
TARGET_H = 1920


def _ffprobe_duration(path: str) -> float:
    """Return clip duration in seconds via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 10.0


def _escape_sub_path(raw_path: str) -> str:
    """Make a subtitle path safe for the FFmpeg subtitles= filtergraph."""
    abs_path = Path(raw_path).absolute().as_posix()
    # FFmpeg filtergraph needs colons and single quotes escaped
    return abs_path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _validate_subtitle_content(sub_path: str) -> None:
    """Raise if the subtitle file is missing, empty, or just a placeholder stub."""
    p = Path(sub_path)
    if not p.exists():
        raise FileNotFoundError(f"Subtitle file not found: {sub_path}")
    text = p.read_text(encoding="utf-8").strip()

    # ASS files use "Dialogue:" lines; SRT files use "-->" timing lines
    is_ass = sub_path.endswith(".ass")
    if is_ass:
        dialogue_count = text.count("Dialogue:")
        if dialogue_count < 3:
            raise ValueError(
                f"ASS subtitle has only {dialogue_count} Dialogue line(s) — "
                f"TTS word-boundary capture likely failed upstream: {sub_path}"
            )
    else:
        # Legacy SRT path (shouldn't be hit anymore, but just in case)
        if "-->" not in text:
            raise ValueError(
                f"SRT has no timing cues — likely a placeholder stub: {sub_path}"
            )
        cue_count = text.count("-->")
        if cue_count < 3:
            raise ValueError(
                f"SRT only has {cue_count} cue(s) — TTS word-boundary capture "
                f"likely failed upstream: {sub_path}"
            )


def _build_filtergraph(
    timeline: "RenderTimeline" = None,
    n_clips: int = 0, # legacy
    audio_dur: float = 0.0,
    sub_path: str = "",
    watermark_path: str | None = None,
    watermark_opacity: float = 0.4,
    watermark_position: str = "bottom_right",
    watermark_scale: float = 0.12,
) -> str:
    """
    Construct FFmpeg filtergraph using precise timeline durations.
    """
    fade_dur = 0.3
    parts: list[str] = []
    
    has_timeline = timeline and timeline.scenes
    clips_count = len(timeline.scenes) if has_timeline else n_clips
    
    if not has_timeline:
        # Legacy fallback
        if clips_count > 1:
            seg = (audio_dur + (clips_count - 1) * fade_dur) / clips_count
        else:
            seg = audio_dur
        durations = [seg] * clips_count
    else:
        durations = [scene.duration + fade_dur if i < clips_count - 1 else scene.duration for i, scene in enumerate(timeline.scenes)]

    # -- Per-clip processing --------------------------------------------------
    for i in range(clips_count):
        seg = durations[i]
        parts.append(
            f"[{i}:v]"
            f"fps=30,"
            f"format=yuv420p,"
            f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=increase,"
            f"crop={TARGET_W}:{TARGET_H},"
            f"trim=duration={seg:.3f},"
            f"setpts=PTS-STARTPTS,"
            f"eq=contrast=1.05:brightness=0.02:saturation=1.1"
            f"[v{i}];"
        )

    # -- Concatenation with xfade ---------------------------------------------
    after_concat = "[base]"
    if clips_count <= 1:
        parts.append(f"[v0]copy{after_concat};")
    else:
        last_out = "[v0]"
        current_offset = 0.0
        for i in range(1, clips_count):
            if has_timeline:
                current_offset += timeline.scenes[i-1].duration
            else:
                current_offset = i * durations[0] - i * fade_dur
                
            out_name = f"[v_fade_{i}]" if i < clips_count - 1 else after_concat
            parts.append(
                f"{last_out}[v{i}]xfade=transition=fade:duration={fade_dur}:offset={current_offset:.3f}{out_name};"
            )
            last_out = out_name

    # -- Subtitles (ASS with embedded style — no force_style needed) ----------
    safe_sub = _escape_sub_path(sub_path)
    after_subs = "subbed"
    parts.append(
        f"{after_concat}subtitles=filename='{safe_sub}'"
        f"[{after_subs}];"
    )

    # -- Watermark overlay (optional) -----------------------------------------
    if watermark_path and Path(watermark_path).exists():
        wm_input_idx = clips_count + 1   # audio is n_clips, watermark is n_clips+1
        wm_w = int(TARGET_W * watermark_scale)

        # Position mapping
        pos_map = {
            "bottom_right": (f"W-w-30", f"H-h-30"),
            "bottom_left":  ("30",       f"H-h-30"),
            "top_right":    (f"W-w-30", "30"),
            "top_left":     ("30",       "30"),
        }
        ox, oy = pos_map.get(watermark_position, pos_map["bottom_right"])

        parts.append(
            f"[{wm_input_idx}:v]"
            f"scale={wm_w}::-1,"
            f"format=rgba,"
            f"colorchannelmixer=aa={watermark_opacity:.2f}"
            f"[wm];"
        )
        parts.append(
            f"[{after_subs}][wm]overlay={ox}:{oy}[out]"
        )
    else:
        # No watermark — just alias the output
        parts.append(f"[{after_subs}]copy[out]")

    return "".join(parts)


def assemble_video(
    timeline: "RenderTimeline" = None,
    clip_paths: list[str] = None, # legacy
    audio_path: str = "",
    srt_path: str = "",
    out_path: str | None = None,
    style: str = "fast_facts",
    caption_style: str = "bold_centered",
    word_boundaries: list[dict] | None = None,
    watermark_path: str | None = None,
    watermark_opacity: float = 0.4,
    watermark_position: str = "bottom_right",
    watermark_scale: float = 0.12,
) -> str:
    """
    Build the final MP4 with styled captions and optional watermark.
    Returns path to the finished video file.

    If word_boundaries are provided (from the TTS step), the ASS subtitle
    file is (re)generated with the correct caption_style before rendering.
    This ensures the visual style matches the user's selection rather than
    whatever default the TTS step wrote.
    """
    if not clip_paths:
        raise ValueError("No clips provided to assemble_video")

    # ── Generate / regenerate ASS with the correct caption style ─────────
    if word_boundaries:
        # Derive .ass path next to the audio
        sub_path = str(Path(srt_path).with_suffix(".ass"))
        build_karaoke_ass(
            word_boundaries, sub_path,
            style_key=caption_style,
        )
        log.info("Built ASS subtitle with style='%s' → %s", caption_style, sub_path)
    else:
        sub_path = srt_path

    # ── Pre-render subtitle validation ───────────────────────────────────
    _validate_subtitle_content(sub_path)

    out_path = out_path or str(RENDER_DIR / f"short_{uuid.uuid4().hex[:8]}.mp4")
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)

    # Get audio duration
    audio_dur = _ffprobe_duration(audio_path)
    log.info("Audio duration: %.2fs, using %d clip(s)", audio_dur, len(clip_paths))

    # Build input flags — clips first, then audio, then optional watermark
    input_flags: list[str] = []
    for cp in clip_paths:
        input_flags += ["-stream_loop", "-1", "-t", str(audio_dur + 0.5), "-i", cp]
    input_flags += ["-i", audio_path]

    if watermark_path and Path(watermark_path).exists():
        input_flags += ["-i", watermark_path]

    # Build filtergraph
    fg = _build_filtergraph(
        timeline=timeline,
        n_clips=len(clip_paths) if clip_paths else 0,
        audio_dur=audio_dur,
        sub_path=sub_path,
        watermark_path=watermark_path,
        watermark_opacity=watermark_opacity,
        watermark_position=watermark_position,
        watermark_scale=watermark_scale,
    )

    cmd = [
        "ffmpeg", "-y",
        *input_flags,
        "-filter_complex", fg,
        "-map", "[out]",
        "-map", f"{len(clip_paths)}:a",
        "-c:v", "h264_nvenc",
        "-preset", "p4",
        "-cq", "23",
        "-b:v", "0",
        "-c:a", "aac",
        "-b:a", "128k",
        "-r", "30",
        "-t", str(audio_dur + 0.5),
        "-movflags", "+faststart",
        out_path,
    ]

    log.info("Running FFmpeg assembly (caption=%s, watermark=%s)...",
             caption_style, "yes" if watermark_path else "no")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Post-render verification step
    stderr = result.stderr.lower()
    has_filter_error = "error initializing filters" in stderr or "error while filtering" in stderr
    
    if result.returncode != 0 or has_filter_error:
        log.error("FFmpeg stderr: %s", result.stderr[-2000:])
        raise RuntimeError(f"FFmpeg failed (code {result.returncode}): {result.stderr[-500:]}")

    if not Path(out_path).exists() or Path(out_path).stat().st_size == 0:
        log.error("FFmpeg failed to produce an output file. Stderr: %s", result.stderr[-2000:])
        raise RuntimeError("FFmpeg assembly failed: No output file generated.")

    log.info("Video assembled → %s", out_path)
    return out_path


import asyncio

async def async_assemble_video(**kwargs) -> str:
    """Async wrapper — runs FFmpeg in a thread pool to avoid blocking the event loop."""
    return await asyncio.to_thread(assemble_video, **kwargs)

def assemble_job(job: RenderJob) -> str:
    """Assemble a video using a RenderJob object."""
    from engine.story.timeline import align_scenes_to_audio
    
    job.output_path = job.output_path or str(RENDER_DIR / f"short_{uuid.uuid4().hex[:8]}.mp4")
    
    # 1. Build the timeline
    timeline = align_scenes_to_audio(
        job.story_spec,
        job.word_boundaries,
        job.audio_path,
        job.sub_path
    )
    
    # If the timeline has fewer scenes than clips, just fall back to passing the raw clips
    # to avoid index out-of-bounds in ffmpeg.
    if len(timeline.scenes) != len(job.clip_paths):
        timeline = None
        
    out_path = assemble_video(
        timeline=timeline,
        clip_paths=job.clip_paths,
        audio_path=job.audio_path,
        srt_path=job.sub_path,
        out_path=job.output_path,
        style=job.style,
        caption_style=job.caption_style,
        word_boundaries=job.word_boundaries,
        watermark_path=job.watermark_path,
        watermark_opacity=job.watermark_opacity,
        watermark_position=job.watermark_position,
        watermark_scale=job.watermark_scale,
    )
    job.output_path = out_path
    return out_path

async def async_assemble_job(job: RenderJob) -> str:
    """Async wrapper for assemble_job."""
    return await asyncio.to_thread(assemble_job, job)
