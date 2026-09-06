from dataclasses import dataclass, field
from engine.story.schemas import StorySpec

@dataclass
class RenderJob:
    """All data needed to assemble a final video, collected across pipeline stages."""
    video_id: str
    story_spec: StorySpec
    niche: str
    caption_style: str = "bold_centered"
    style: str = "fast_facts"
    language: str = "en"

    # Populated by TTS stage
    audio_path: str = ""
    sub_path: str = ""
    word_boundaries: list[dict] = field(default_factory=list)
    duration: float = 0.0
    voice: str = ""

    # Populated by visuals stage
    clip_paths: list[str] = field(default_factory=list)

    # Populated by assembler
    output_path: str = ""

    # Watermark settings (from profile)
    watermark_path: str | None = None
    watermark_opacity: float = 0.4
    watermark_position: str = "bottom_right"
    watermark_scale: float = 0.12
