from typing import List, Optional

from pydantic import BaseModel, Field


# --- Ideas ---
class IdeaCandidate(BaseModel):
    title: str = Field(..., description="A catchy title for the video")
    topic: str = Field(..., description="The core subject matter")
    angle: str = Field(..., description="The unique perspective or hook")
    rationale: str = Field(..., description="Why this idea is likely to perform well")


class IdeaBatch(BaseModel):
    ideas: List[IdeaCandidate] = Field(..., description="List of generated video ideas")


class ImprovedIdea(BaseModel):
    title: str = Field(..., description="The improved title")
    angle: str = Field(..., description="The refined angle")
    improvements_made: List[str] = Field(..., description="What was changed and why")


class AdvancedHookCandidate(BaseModel):
    hook_text: str = Field(..., description="The spoken hook text (first 3-5 seconds).")
    angle: str = Field(..., description="The psychological angle or trigger used.")
    expected_retention_score: int = Field(
        ..., description="Expected retention score (0-100)."
    )
    target_audience: str = Field(..., description="Who this specific hook appeals to.")
    visual_suggestion: str = Field(
        ..., description="What should be shown on screen during the hook."
    )


class HookBatch(BaseModel):
    candidates: List[AdvancedHookCandidate] = Field(
        ..., description="List of generated hook candidates."
    )
    best_hook_index: int = Field(
        ..., description="Index of the best overall hook in the candidates list."
    )
    analysis: str = Field(
        ..., description="Brief analysis of why the best hook was chosen."
    )


# --- Scripts ---
class ScriptOutline(BaseModel):
    hook: str = Field(..., description="The hook (first 3 seconds)")
    escalation: str = Field(..., description="The escalation phase")
    explanation: str = Field(..., description="The explanation phase")
    payoff: str = Field(..., description="The payoff phase")
    cta: str = Field(..., description="The call to action")


class ScriptScene(BaseModel):
    scene_number: int = Field(..., description="Sequential scene number")
    narration: str = Field(..., description="The exact spoken text for the scene")
    visual_description: str = Field(
        ..., description="Description of what is seen on screen"
    )
    visual_intent: Optional[str] = Field(
        None, description="The emotional or thematic intent of the visual"
    )


class ScriptDraft(BaseModel):
    hook: str = Field(..., description="The opening hook")
    body: List[ScriptScene] = Field(..., description="The main content scenes")
    payoff: str = Field(..., description="The climax or main takeaway")
    cta: str = Field(..., description="The call to action")
    estimated_duration_seconds: int = Field(
        ..., description="Estimated total duration in seconds"
    )


class ScriptCritique(BaseModel):
    score: int = Field(..., description="Overall score out of 100")
    feedback: List[str] = Field(..., description="Specific points for improvement")
    approved: bool = Field(
        ..., description="Whether the script meets quality standards"
    )


class SceneEditResult(BaseModel):
    narration: str = Field(..., description="The new edited narration text.")


# --- Visuals ---
class AssetSelection(BaseModel):
    selected_asset_id: str = Field(..., description="The ID of the chosen asset")
    rationale: str = Field(..., description="Why this asset was selected")
    crop_recommendation: Optional[str] = Field(
        None, description="Suggested crop if necessary"
    )


class AssetValidation(BaseModel):
    is_valid: bool = Field(
        ..., description="Whether the asset is appropriate for the scene"
    )
    issues: List[str] = Field(
        ..., description="Any visual defects, watermarks, or misalignments"
    )


class VisualPrompt(BaseModel):
    prompt: str = Field(
        ..., description="The exact prompt to send to the image/video generator"
    )
    style: str = Field(..., description="The visual style")


# --- Publishing ---
class SEOAnalysis(BaseModel):
    optimized_title: str = Field(..., description="SEO-optimized title")
    optimized_description: str = Field(
        ..., description="SEO-optimized description with hashtags"
    )
    tags: List[str] = Field(..., description="Keywords/tags for metadata")


# --- Research/Fact Checking ---
class ClaimEvidence(BaseModel):
    source: str = Field(..., description="Where the evidence came from")
    excerpt: str = Field(..., description="The relevant text from the source")
    supports_claim: bool = Field(..., description="Does it support the claim?")


class ClaimVerification(BaseModel):
    claim: str = Field(..., description="The claim being verified")
    verdict: str = Field(
        ...,
        description="'supported', 'partially_supported', 'unsupported', 'contradicted'",
    )
    confidence: int = Field(..., description="Confidence score out of 100")
    evidence: List[ClaimEvidence] = Field(..., description="Evidence collected")
