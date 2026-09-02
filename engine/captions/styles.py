"""
Caption style definitions for FFmpeg ASS subtitle burn-in.
Each style maps to a set of ASS force_style parameters that produce
a distinct visual appearance in the rendered video.

Users pick a style key from the frontend; the assembler applies it.
"""
from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class CaptionPreset:
    """One selectable caption style."""
    key:         str   # unique identifier
    name:        str   # display name for the UI
    description: str   # short blurb shown under the preview
    preview_css: str   # CSS snippet the frontend uses for a live text preview
    force_style: str   # the actual FFmpeg ASS force_style string


# ── Preset Library ────────────────────────────────────────────────────────────

CAPTION_STYLES: dict[str, CaptionPreset] = {}


def _register(preset: CaptionPreset) -> None:
    CAPTION_STYLES[preset.key] = preset


_register(CaptionPreset(
    key="bold_centered",
    name="Bold Center",
    description="Classic bold white text, centered at the bottom",
    preview_css="font-family:'Arial Black',sans-serif;font-size:22px;font-weight:900;color:#fff;text-shadow:2px 2px 4px rgba(0,0,0,0.9);text-align:center;",
    force_style=(
        "FontName=Arial,FontSize=24,Bold=1,"
        "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
        "Outline=2,Shadow=1,Alignment=2,MarginV=80"
    ),
))

_register(CaptionPreset(
    key="neon_glow",
    name="Neon Glow",
    description="Electric cyan text with a glowing outline",
    preview_css="font-family:'Inter',sans-serif;font-size:22px;font-weight:800;color:#00ffff;text-shadow:0 0 12px #00ffff,0 0 24px rgba(0,255,255,0.5);text-align:center;",
    force_style=(
        "FontName=Arial,FontSize=24,Bold=1,"
        "PrimaryColour=&H00FFFF00,OutlineColour=&H00FF8800,"
        "Outline=3,Shadow=0,Alignment=2,MarginV=80"
    ),
))

_register(CaptionPreset(
    key="karaoke_pop",
    name="Karaoke Pop",
    description="Bright yellow with black stroke — high contrast pop style",
    preview_css="font-family:'Impact',sans-serif;font-size:26px;font-weight:900;color:#FFD700;-webkit-text-stroke:2px #000;text-align:center;",
    force_style=(
        "FontName=Impact,FontSize=26,Bold=1,"
        "PrimaryColour=&H0000D7FF,OutlineColour=&H00000000,"
        "Outline=3,Shadow=0,Alignment=2,MarginV=80"
    ),
))

_register(CaptionPreset(
    key="minimal_lower",
    name="Minimal Lower",
    description="Clean thin text pinned to the lower third",
    preview_css="font-family:'Inter',sans-serif;font-size:16px;font-weight:400;color:rgba(255,255,255,0.9);text-align:center;letter-spacing:0.05em;",
    force_style=(
        "FontName=Arial,FontSize=18,Bold=0,"
        "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
        "Outline=1,Shadow=0,Alignment=2,MarginV=60"
    ),
))

_register(CaptionPreset(
    key="box_highlight",
    name="Box Highlight",
    description="White text on a semi-transparent dark box",
    preview_css="font-family:'Inter',sans-serif;font-size:20px;font-weight:700;color:#fff;background:rgba(0,0,0,0.7);padding:6px 16px;border-radius:6px;text-align:center;",
    force_style=(
        "FontName=Arial,FontSize=22,Bold=1,"
        "PrimaryColour=&H00FFFFFF,BackColour=&H80000000,"
        "BorderStyle=4,Outline=0,Shadow=0,Alignment=2,MarginV=80"
    ),
))

_register(CaptionPreset(
    key="gradient_fire",
    name="Gradient Fire",
    description="Warm orange-red text with thick black outline",
    preview_css="font-family:'Arial Black',sans-serif;font-size:24px;font-weight:900;background:linear-gradient(90deg,#ff6b35,#f7c948);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(2px 2px 3px rgba(0,0,0,0.8));text-align:center;",
    force_style=(
        "FontName=Arial,FontSize=24,Bold=1,"
        "PrimaryColour=&H003568FF,OutlineColour=&H00000000,"
        "Outline=3,Shadow=1,Alignment=2,MarginV=80"
    ),
))

_register(CaptionPreset(
    key="typewriter",
    name="Typewriter",
    description="Monospace font with a retro terminal feel",
    preview_css="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#00ff88;text-shadow:0 0 8px rgba(0,255,136,0.5);text-align:center;letter-spacing:0.08em;",
    force_style=(
        "FontName=Courier New,FontSize=20,Bold=1,"
        "PrimaryColour=&H0088FF00,OutlineColour=&H00000000,"
        "Outline=2,Shadow=0,Alignment=2,MarginV=80"
    ),
))


def get_caption_style(key: str) -> CaptionPreset:
    """Return a preset by key, falling back to bold_centered."""
    return CAPTION_STYLES.get(key, CAPTION_STYLES["bold_centered"])


def list_caption_styles() -> list[dict]:
    """Return all presets as serialisable dicts for the frontend."""
    return [
        {
            "key": p.key,
            "name": p.name,
            "description": p.description,
            "preview_css": p.preview_css,
        }
        for p in CAPTION_STYLES.values()
    ]
