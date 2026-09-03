r"""
Caption style definitions for FFmpeg ASS subtitle burn-in.
Each style maps to a set of ASS force_style parameters that produce
a distinct visual appearance in the rendered video.

Users pick a style key from the frontend; the assembler applies it.

Since v0.3 the pipeline generates full ASS files with karaoke (\kf)
tags rather than plain SRT, so the style is embedded in the [V4+ Styles]
header.  The `ass_*` fields on CaptionPreset drive that header.
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class CaptionPreset:
    """One selectable caption style."""
    key:         str   # unique identifier
    name:        str   # display name for the UI
    description: str   # short blurb shown under the preview
    preview_css: str   # CSS snippet the frontend uses for a live text preview
    force_style: str   # legacy FFmpeg force_style string (kept for compat)
    # ── ASS V4+ Style fields for karaoke subtitle generation ──
    ass_fontname:        str = "Arial Black"
    ass_fontsize:        int = 72
    ass_primary_colour:  str = "&H00FFFFFF"   # post-highlight (spoken) colour
    ass_secondary_colour:str = "&H0000D7FF"   # fill colour during \kf highlight
    ass_outline_colour:  str = "&H00000000"
    ass_back_colour:     str = "&H00000000"
    ass_bold:            int = 1
    ass_border_style:    int = 1              # 1 = outline+shadow, 4 = opaque box
    ass_outline:         int = 4
    ass_shadow:          int = 0
    ass_alignment:       int = 5              # 5 = middle-center
    ass_margin_v:        int = 0


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
    ass_fontname="Arial Black", ass_fontsize=72,
    ass_primary_colour="&H00FFFFFF", ass_secondary_colour="&H0000D7FF",
    ass_outline_colour="&H00000000",
    ass_outline=4, ass_shadow=1, ass_margin_v=0,
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
    ass_fontname="Arial", ass_fontsize=72,
    ass_primary_colour="&H00FFFF00", ass_secondary_colour="&H0088FF00",
    ass_outline_colour="&H00FF8800",
    ass_outline=5, ass_shadow=0, ass_margin_v=0,
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
    ass_fontname="Impact", ass_fontsize=78,
    ass_primary_colour="&H0000D7FF", ass_secondary_colour="&H000000FF",
    ass_outline_colour="&H00000000",
    ass_outline=4, ass_shadow=0, ass_margin_v=0,
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
    ass_fontname="Arial", ass_fontsize=56, ass_bold=0,
    ass_primary_colour="&H00FFFFFF", ass_secondary_colour="&H0000D7FF",
    ass_outline_colour="&H00000000",
    ass_outline=2, ass_shadow=0, ass_margin_v=0,
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
    ass_fontname="Arial", ass_fontsize=68,
    ass_primary_colour="&H00FFFFFF", ass_secondary_colour="&H0000D7FF",
    ass_outline_colour="&H00000000", ass_back_colour="&H80000000",
    ass_border_style=4, ass_outline=0, ass_shadow=0, ass_margin_v=0,
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
    ass_fontname="Arial Black", ass_fontsize=72,
    ass_primary_colour="&H003568FF", ass_secondary_colour="&H0048C9FF",
    ass_outline_colour="&H00000000",
    ass_outline=4, ass_shadow=1, ass_margin_v=0,
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
    ass_fontname="Courier New", ass_fontsize=64,
    ass_primary_colour="&H0088FF00", ass_secondary_colour="&H0000FF88",
    ass_outline_colour="&H00000000",
    ass_outline=3, ass_shadow=0, ass_margin_v=0,
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


# ── Karaoke ASS Generator ────────────────────────────────────────────────────

def build_karaoke_ass(
    word_boundaries: list[dict],
    out_path: str,
    style_key: str = "bold_centered",
    group_size: int = 4,
) -> str:
    """
    Build an ASS subtitle file with karaoke-style per-word highlighting.

    word_boundaries: list of {"text": str, "offset": float, "duration": float}
                     (seconds), as returned by voiceover.generate_voiceover().
    style_key:       key into CAPTION_STYLES for the visual look.
    group_size:      how many words are shown on screen at once (TikTok-style
                     typically uses 2-4).

    Each word group appears as a Dialogue line; within it, \\kf tags drive
    a smooth left-to-right fill highlight as each word is spoken.
    Returns the output path.
    """
    preset = get_caption_style(style_key)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        "PlayResY: 1920\n"
        "WrapStyle: 0\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{preset.ass_fontname},{preset.ass_fontsize},"
        f"{preset.ass_primary_colour},{preset.ass_secondary_colour},"
        f"{preset.ass_outline_colour},{preset.ass_back_colour},"
        f"{preset.ass_bold},0,0,0,100,100,0,0,"
        f"{preset.ass_border_style},{preset.ass_outline},{preset.ass_shadow},"
        f"{preset.ass_alignment},40,40,{preset.ass_margin_v},1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    def _ts(t: float) -> str:
        """Format seconds as ASS timestamp H:MM:SS.cc"""
        h, rem = divmod(max(0, t), 3600)
        m, s = divmod(rem, 60)
        return f"{int(h)}:{int(m):02d}:{s:05.2f}"

    lines: list[str] = []
    for i in range(0, len(word_boundaries), group_size):
        group = word_boundaries[i : i + group_size]
        start = group[0]["offset"]
        end   = group[-1]["offset"] + group[-1]["duration"] + 0.15  # overlap pad

        # Each word gets a \kf tag (centiseconds) for the fill-highlight sweep
        parts: list[str] = []
        for w in group:
            cs = max(1, int(w["duration"] * 100))
            parts.append(f"{{\\kf{cs}}}{w['text']} ")

        text = f"{{\\an5\\pos(540,1350)\\fad(100,100)}}" + "".join(parts).rstrip()
        lines.append(
            f"Dialogue: 0,{_ts(start)},{_ts(end)},Default,,0,0,0,,{text}"
        )

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(header + "\n".join(lines) + "\n", encoding="utf-8")

    log.info("ASS karaoke subtitle → %s (%d dialogue lines)", out_path, len(lines))
    return out_path
