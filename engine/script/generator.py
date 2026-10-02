"""
Script generator — builds a structured script from a topic + niche config.
Outputs a canonical StorySpec using StoryPlanner.
"""

from __future__ import annotations

import logging

from engine.story.planner import StoryPlanner

log = logging.getLogger(__name__)

# ── Prompt templates per niche ─────────────────────────────────────────────────

_PROMPTS: dict[str, str] = {
    "kids_facts": """You are a friendly, enthusiastic scriptwriter for a children's YouTube {content_type} channel.

Write a fun, educational script about: {topic}

Rules:
- Target duration: {target_duration_seconds} seconds when read aloud.
- Structure your script exactly as: HOOK, ESCALATION, EXPLANATION, PAYOFF, CTA.
- The first 3 seconds MUST answer: "Why should I continue watching?"
- HOOK: A single curiosity scene (question or surprising statement). Use formula: [Specific scenario] + [question] + [consequence]
- ESCALATION: Build the mystery.
- EXPLANATION: Simple, fun facts (as if explaining to a 6-year-old).
- PAYOFF: The most amazing part.
- CTA: "Follow us to learn more amazing stuff!"
- NO scary, violent, or adult themes.
- NO unsupported claims (extract key facts into the claims array).
- visual_intent: A high level visual concept for the scene.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. (e.g. "monarch butterfly close up wings")
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK" unless impossible to find.
""",
    "science_wow": """You are a scriptwriter for a science YouTube {content_type} channel targeting curious adults and teens.

Write a punchy, mind-blowing script about: {topic}

Rules:
- Target duration: {target_duration_seconds} seconds when read aloud.
- Structure your script exactly as: HOOK, ESCALATION, EXPLANATION, PAYOFF, CTA.
- The first 3 seconds MUST answer: "Why should I continue watching?"
- HOOK: Use formula: [Specific scenario] + [question] + [consequence]. (e.g. "If both engines fail at 35,000 feet, what happens next? The answer might save your life.")
- ESCALATION: Build tension or curiosity.
- EXPLANATION: 1-2 fact scenes — extreme brevity, highly surprising.
- PAYOFF: A "wait, that means..." moment that connects to everyday life.
- CTA: "Follow for a new mind-blowing fact every day."
- No clickbait or false claims (extract key facts into the claims array).
- visual_intent: High level visual concept.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. DO NOT use single abstract keywords.
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK".
""",
    "tech_mysteries": """You are a scriptwriter for a technology mysteries YouTube {content_type} channel.

Write a sharp, intelligent script about: {topic}

Rules:
- Target duration: {target_duration_seconds} seconds at a fast speaking pace.
- Structure your script exactly as: HOOK, ESCALATION, EXPLANATION, PAYOFF, CTA.
- The first 3 seconds MUST answer: "Why should I continue watching?"
- HOOK: Frame as a mystery using: [Specific scenario] + [question] + [consequence].
- ESCALATION: Raise the stakes of the mystery.
- EXPLANATION: 1-2 body scenes explaining the mechanism simply and quickly.
- PAYOFF: The "aha" moment of understanding.
- CTA: "Follow for more tech secrets you never knew."
- Accurate — no speculation presented as fact (extract facts to claims array).
- visual_intent: High level visual concept.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete.
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK".
""",
}

_DEFAULT_PROMPT = _PROMPTS["science_wow"]


def generate_script(
    topic: str,
    niche: str = "science_wow",
    language: str = "en",
    provider: str | None = None,
    model: str | None = None,
    content_type: str = "short",
    target_duration_seconds: int = 30,
) -> tuple:
    """
    Generate a structured script for the given topic.
    Returns (story_spec, provider_used, cost_data).
    """
    template = _PROMPTS.get(niche, _DEFAULT_PROMPT)
    if language != "en":
        template += f"\n- MUST write the script entirely in language code: {language}\n"

    if content_type == "long_form":
        template += "\n- This is a long-form video. Add a dedicated INTRO, deep-dive EXPLANATION chapters, and a conclusion.\n"

    planner = StoryPlanner(max_retries=2)

    story_spec, provider_used, cost_data = planner.generate_story(
        topic=topic,
        prompt_template=template,
        preferred_provider=provider,
        preferred_model=model,
        content_type=content_type,
        target_duration_seconds=target_duration_seconds,
    )

    return story_spec, provider_used, cost_data
