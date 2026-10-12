"""
Agentic Script generator using LangGraph.
Upgrades the single-shot generator to a multi-step iterative workflow using centralized AI gateway and structured schemas.
"""

import logging
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from backend.ai.gateway.llm_gateway import generate_structured
from backend.ai.prompts.prompts import (
    SCRIPT_CRITIQUE_V1,
    SCRIPT_DRAFT_V2,
    SCRIPT_OUTLINE_V1,
    SCRIPT_REFINE_V1,
)
from backend.ai.schemas.schemas import ScriptCritique, ScriptDraft, ScriptOutline
from engine.story.schemas import StorySpec

log = logging.getLogger(__name__)


class ScriptState(TypedDict, total=False):
    # Inputs
    topic: str
    niche: str
    language: str
    content_type: str
    target_duration_seconds: int
    custom_prompt: str
    preferred_provider: str
    preferred_model: str

    # Workflow State
    outline: Optional[ScriptOutline]
    draft_script: Optional[ScriptDraft]
    feedback: Optional[ScriptCritique]

    # Outputs
    story_spec: Optional[StorySpec]
    provider_used: str
    cost_data: dict
    errors: list[str]


async def node_outline(state: ScriptState) -> dict:
    """Generate the initial outline (Hook, Build, Climax)."""
    log.info("Agentic Node: Generating Outline")
    context = {
        "content_type": state.get("content_type", "short"),
        "topic": state.get("topic", ""),
        "duration": state.get("target_duration_seconds", 30),
        "language": state.get("language", "en"),
        "custom_prompt": state.get("custom_prompt") or "None",
    }

    parsed, meta = await generate_structured(
        "generate_outline",
        SCRIPT_OUTLINE_V1,
        ScriptOutline,
        context,
        policy="reasoning",
    )

    return {
        "outline": parsed,
        "provider_used": meta.get("provider", "unknown"),
        "cost_data": meta,
    }


async def node_draft(state: ScriptState) -> dict:
    """Expand the outline into a full script with visual cues."""
    log.info("Agentic Node: Generating Draft")
    outline = state.get("outline")
    outline_json = outline.model_dump_json() if outline else ""

    context = {"outline": outline_json}

    parsed, meta = await generate_structured(
        "generate_draft", SCRIPT_DRAFT_V2, ScriptDraft, context, policy="reasoning"
    )

    return {"draft_script": parsed}


async def node_critique(state: ScriptState) -> dict:
    """Self-critique the draft for engagement and pacing."""
    log.info("Agentic Node: Critiquing Draft")
    draft = state.get("draft_script")
    draft_json = draft.model_dump_json() if draft else ""

    context = {"draft": draft_json}

    parsed, meta = await generate_structured(
        "critique_draft", SCRIPT_CRITIQUE_V1, ScriptCritique, context, policy="fast"
    )

    return {"feedback": parsed}


async def node_refine_and_format(state: ScriptState) -> dict:
    """Apply critique and format into strict StorySpec JSON."""
    log.info("Agentic Node: Refining and Formatting to JSON")
    draft = state.get("draft_script")
    feedback = state.get("feedback")

    draft_json = draft.model_dump_json() if draft else ""
    feedback_json = feedback.model_dump_json() if feedback else ""

    context = {"draft": draft_json, "feedback": feedback_json}

    parsed, meta = await generate_structured(
        "refine_script", SCRIPT_REFINE_V1, StorySpec, context, policy="reasoning"
    )

    if parsed:
        parsed.topic = state.get("topic", "Untitled")

    return {"story_spec": parsed}


# Define the graph
def build_script_graph():
    workflow = StateGraph(ScriptState)

    # Add nodes
    workflow.add_node("outline", node_outline)
    workflow.add_node("draft", node_draft)
    workflow.add_node("critique", node_critique)
    workflow.add_node("refine_and_format", node_refine_and_format)

    # Add edges
    workflow.add_edge(START, "outline")
    workflow.add_edge("outline", "draft")
    workflow.add_edge("draft", "critique")

    # Conditional logic
    def check_feedback(state: ScriptState):
        fb = state.get("feedback")
        if fb and getattr(fb, "approved", False):
            return "refine_and_format"
        return "refine_and_format"

    workflow.add_conditional_edges(
        "critique", check_feedback, {"refine_and_format": "refine_and_format"}
    )
    workflow.add_edge("refine_and_format", END)

    return workflow.compile()


graph = build_script_graph()


async def generate_script_agentic(
    topic: str,
    niche: str = "science_wow",
    language: str = "en",
    provider: str | None = None,
    model: str | None = None,
    content_type: str = "short",
    target_duration_seconds: int = 30,
    custom_prompt: str | None = None,
    target_audience: str | None = None,
    tone: str | None = None,
    format_type: str | None = None,
) -> tuple:
    """
    Generate a structured script using the multi-agent LangGraph workflow.
    Returns (story_spec, provider_used, cost_data).
    """
    initial_state = {
        "topic": topic,
        "niche": niche,
        "language": language,
        "content_type": content_type,
        "target_duration_seconds": target_duration_seconds,
        "custom_prompt": custom_prompt,
        "preferred_provider": provider,
        "preferred_model": model,
        "cost_data": {},
        "errors": [],
    }

    log.info(f"Starting Agentic Script Generation for: {topic}")

    # Run the compiled LangGraph workflow asynchronously
    result = await graph.ainvoke(initial_state)

    if not result.get("story_spec"):
        raise RuntimeError(
            f"Agentic workflow failed to produce valid StorySpec. Errors: {result.get('errors')}"
        )

    return (
        result["story_spec"],
        result.get("provider_used", "unknown"),
        result.get("cost_data", {}),
    )
