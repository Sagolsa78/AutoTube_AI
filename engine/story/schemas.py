from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime

class Evidence(BaseModel):
    source_url: str = Field(default="", description="URL of the evidence source")
    title: str = Field(default="", description="Title of the source")
    publisher: str = Field(default="", description="Publisher or domain")
    excerpt: str = Field(default="", description="Relevant excerpt from the source")
    support_score: float = Field(default=1.0, description="How strongly this supports the claim (0.0 to 1.0)")
    retrieved_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class Claim(BaseModel):
    claim_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str = Field(..., description="The factual claim text")
    importance: Literal["low", "medium", "high"] = Field(default="medium")
    confidence: float = Field(default=1.0)
    evidence: List[Evidence] = Field(default_factory=list)

class SceneSpec(BaseModel):
    scene_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scene_number: int = Field(..., description="Sequential scene number")
    purpose: Literal["hook", "body", "payoff", "cta"] = Field(default="body")
    narration: str = Field(..., description="The exact text to be spoken")
    claim_ids: List[str] = Field(default_factory=list, description="IDs of factual claims made in this scene")
    
    # Visual intent
    visual_intent: str = Field(..., description="High level visual concept")
    stock_query: str = Field(default="", description="Specific 3-5 word search query for stock footage")
    generation_prompt: str = Field(default="", description="Detailed prompt for AI image/video generation")
    preferred_visual_mode: Literal["STOCK", "GENERATED_VIDEO", "GENERATED_IMAGE", "MOTION_GRAPHIC", "SOURCE_FOOTAGE"] = Field(default="STOCK")
    
    # Runtime Asset Info
    asset_id: Optional[str] = None
    asset_path: Optional[str] = None

    # Timing
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    duration: Optional[float] = None
    
    # Scoring/Budget
    importance: Literal["low", "medium", "high"] = Field(default="medium")
    generation_priority: int = Field(default=1)

class StorySpec(BaseModel):
    story_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    topic: str = Field(..., description="The main topic of the story")
    language: str = Field(default="en")
    locale: str = Field(default="US")
    target_duration: int = Field(default=30, description="Target duration in seconds")
    
    hook: str = Field(default="", description="The text of the opening hook")
    claims: List[Claim] = Field(default_factory=list)
    scenes: List[SceneSpec] = Field(default_factory=list)

    def get_full_text(self) -> str:
        """Returns the full narration text for the entire script."""
        return " ".join(s.narration for s in sorted(self.scenes, key=lambda x: x.scene_number) if s.narration)
