"""
Agentic Script generator using LangGraph.
Upgrades the single-shot generator to a multi-step iterative workflow.
"""

import json
import logging
from typing import Any, Dict, List, TypedDict

from langgraph.graph import END, START, StateGraph

from engine.story.schemas import StorySpec
from engine.story.validator import StoryValidator
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)


class ScriptState(TypedDict):
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
    outline: str
    draft_script: str
    feedback: str
    raw_json: str

    # Outputs
    story_spec: StorySpec
    provider_used: str
    cost_data: dict
    errors: list[str]


def node_outline(state: ScriptState) -> dict:
    """Generate the initial outline (Hook, Build, Climax)."""
    log.info("Agentic Node: Generating Outline")
    prompt = f"""
    Create a 5-part script outline for a YouTube {state['content_type']} about: {state['topic']}.
    Target Duration: {state['target_duration_seconds']} seconds.
    Language: {state['language']}.
    Custom Prompt: {state.get('custom_prompt', 'None')}

    Structure MUST include:
    1. HOOK (first 3 seconds)
    2. ESCALATION
    3. EXPLANATION
    4. PAYOFF
    5. CTA

    Only return the raw outline, no pleasantries.
    """
    response, provider, cost = generate_with_fallback(
        prompt,
        preferred_provider=state.get("preferred_provider"),
        preferred_model=state.get("preferred_model"),
    )
    return {"outline": response, "provider_used": provider, "cost_data": cost}


def node_draft(state: ScriptState) -> dict:
    """Expand the outline into a full script with visual cues."""
    log.info("Agentic Node: Generating Draft")
    prompt = f"""
    Using this outline, write a full script with visual cues.

    OUTLINE:
    {state['outline']}

    REQUIREMENTS:
    - Include specific 'stock_query' for every scene.
    - Include 'camera_motion' (zoom_in, pan_left, etc)
    - Include 'transition' (cut, fade, etc)
    - Include the exact spoken 'text'.

    Draft it in a clear scene-by-scene format.
    """
    response, provider, cost = generate_with_fallback(
        prompt,
        preferred_provider=state.get("preferred_provider"),
        preferred_model=state.get("preferred_model"),
    )
    # Aggregate costs
    new_cost = state.get("cost_data", {}).copy()
    for k, v in cost.items():
        if isinstance(v, (int, float)):
            new_cost[k] = new_cost.get(k, 0) + v

    return {"draft_script": response, "cost_data": new_cost}


def node_critique(state: ScriptState) -> dict:
    """Self-critique the draft for engagement and pacing."""
    log.info("Agentic Node: Critiquing Draft")
    prompt = f"""
    Critique this short-form script draft for retention and pacing.
    Is the hook strong enough? Are scenes too long? Are visuals concrete?

    DRAFT:
    {state['draft_script']}

    Provide a short bulleted list of 2-3 specific improvements.
    If it's perfect, output "PERFECT".
    """
    response, provider, cost = generate_with_fallback(
        prompt,
        preferred_provider=state.get("preferred_provider"),
        preferred_model=state.get("preferred_model"),
    )
    new_cost = state.get("cost_data", {}).copy()
    for k, v in cost.items():
        if isinstance(v, (int, float)):
            new_cost[k] = new_cost.get(k, 0) + v

    return {"feedback": response, "cost_data": new_cost}


def node_refine_and_format(state: ScriptState) -> dict:
    """Apply critique and format into strict StorySpec JSON."""
    log.info("Agentic Node: Refining and Formatting to JSON")
    schema_dict = StorySpec.model_json_schema()
    schema_json = json.dumps(schema_dict, indent=2)

    prompt = f"""
    You have a draft script and some critique feedback.
    Apply the feedback, refine the script, and output it matching the strict JSON schema.

    DRAFT:
    {state['draft_script']}

    FEEDBACK:
    {state['feedback']}

    You MUST respond ONLY with a valid JSON object matching this schema:
    {schema_json}
    """
    response, provider, cost = generate_with_fallback(
        prompt,
        preferred_provider=state.get("preferred_provider"),
        preferred_model=state.get("preferred_model"),
    )
    new_cost = state.get("cost_data", {}).copy()
    for k, v in cost.items():
        if isinstance(v, (int, float)):
            new_cost[k] = new_cost.get(k, 0) + v

    return {"raw_json": response, "cost_data": new_cost}


def node_validate(state: ScriptState) -> dict:
    """Validate the JSON output."""
    log.info("Agentic Node: Validating JSON")
    raw = state["raw_json"]
    import re

    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and start_idx <= end_idx:
        cleaned = cleaned[start_idx : end_idx + 1]

    try:
        parsed_data = json.loads(cleaned)
        if "topic" not in parsed_data:
            parsed_data["topic"] = state["topic"]
        story_spec = StoryValidator.validate_story_dict(parsed_data)
        return {"story_spec": story_spec, "errors": []}
    except Exception as e:
        log.error(f"Validation failed: {e}")
        return {"errors": [str(e)]}


# Define the graph
def build_script_graph():
    workflow = StateGraph(ScriptState)

    # Add nodes
    workflow.add_node("outline", node_outline)
    workflow.add_node("draft", node_draft)
    workflow.add_node("critique", node_critique)
    workflow.add_node("refine_and_format", node_refine_and_format)
    workflow.add_node("validate", node_validate)

    # Add edges
    workflow.add_edge(START, "outline")
    workflow.add_edge("outline", "draft")
    workflow.add_edge("draft", "critique")

    # Conditional logic
    def check_feedback(state: ScriptState):
        if "PERFECT" in state["feedback"].upper():
            return "refine_and_format"  # Just format
        return (
            "refine_and_format"  # Currently linear, but forces revision incorporation
        )

    workflow.add_conditional_edges(
        "critique", check_feedback, {"refine_and_format": "refine_and_format"}
    )

    workflow.add_edge("refine_and_format", "validate")

    # Retry on validation failure
    def check_validation(state: ScriptState):
        if state.get("errors") and len(state["errors"]) > 0:
            # Simple retry back to format
            if len(state["errors"]) < 3:  # prevent infinite loop
                return "refine_and_format"
            return END
        return END

    workflow.add_conditional_edges(
        "validate",
        check_validation,
        {"refine_and_format": "refine_and_format", END: END},
    )

    return workflow.compile()


graph = build_script_graph()


def generate_script_agentic(
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
    result = graph.invoke(initial_state)

    if not result.get("story_spec"):
        raise RuntimeError(
            f"Agentic workflow failed to produce valid StorySpec. Errors: {result.get('errors')}"
        )

    return result["story_spec"], result["provider_used"], result["cost_data"]
