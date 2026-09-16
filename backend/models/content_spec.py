from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from engine.story.schemas import StorySpec


class BaseJobPayload(BaseModel):
    """Base class for all job payloads."""

    pass


class AssetJobPayload(BaseJobPayload):
    prompt: str = Field(..., description="The prompt to generate the asset.")
    mode: Literal["IMAGE", "VIDEO"] = Field(
        ..., description="The type of asset to generate."
    )


class RenderJobPayload(BaseJobPayload):
    video_id: str = Field(
        ..., description="The ID of the Video model to update upon completion."
    )
    story_spec: StorySpec = Field(..., description="The declarative story structure.")
    niche: str = Field(default="general", description="The niche or channel theme.")
    caption_style: str = Field(
        default="bold_centered", description="Style of the captions."
    )
    style: str = Field(default="fast_facts", description="The general editing style.")
    language: str = Field(default="en", description="The language code.")

    # Render tracking (populated by pipeline stages prior to final render)
    audio_path: str = ""
    bgm_path: Optional[str] = None
    orientation: str = Field(
        default="9:16", description="Video orientation (9:16 or 16:9)"
    )
    sub_path: str = ""
    word_boundaries: List[Dict[str, Any]] = Field(default_factory=list)
    duration: float = 0.0
    voice: str = ""
    clip_paths: List[str] = Field(default_factory=list)
    output_path: str = ""

    # Watermark settings
    watermark_path: Optional[str] = None
    watermark_opacity: float = 0.4
    watermark_position: str = "bottom_right"
    watermark_scale: float = 0.12


class LLMJobPayload(BaseJobPayload):
    system_prompt: str = Field(..., description="The system prompt for the LLM.")
    user_prompt: str = Field(..., description="The user prompt for the LLM.")
    temperature: float = Field(default=0.7)
    model: str = Field(default="gemini-3.1-pro")


class TTSJobPayload(BaseJobPayload):
    text: str = Field(..., description="Text to synthesize.")
    voice_id: str = Field(..., description="The voice ID to use.")
    output_format: str = Field(default="mp3")
