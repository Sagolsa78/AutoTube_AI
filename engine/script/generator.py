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
- HOOK: Use 2-3 very short rapid-fire scenes (1-2 seconds each) with "cut" transitions and dynamic "camera_motion" to build immediate tension. Formula: [scenario] + [question].
- ESCALATION: Build the mystery.
- EXPLANATION: Simple, fun facts (as if explaining to a 6-year-old).
- PAYOFF: The most amazing part.
- CTA: "Follow us to learn more amazing stuff!"
- NO scary, violent, or adult themes.
- NO unsupported claims (extract key facts into the claims array).
- visual_intent: A high level visual concept for the scene.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. (e.g. "monarch butterfly close up wings")
- camera_motion: Pick one: "static", "zoom_in", "zoom_out", "pan_left", "pan_right", "ken_burns".
- transition: Pick one: "cut", "fade", "dip_to_black", "wipe". Use "cut" for rapid pacing.
- emotion: The primary emotion (e.g. "panic", "awe", "curiosity").
- visual_effect: Special effect if needed (e.g. "shake", "flash") or empty string.
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK" unless impossible to find.
""",
    "science_wow": """You are a scriptwriter for a science YouTube {content_type} channel targeting curious adults and teens.

Write a punchy, mind-blowing script about: {topic}

Rules:
- Target duration: {target_duration_seconds} seconds when read aloud.
- Structure your script exactly as: HOOK, ESCALATION, EXPLANATION, PAYOFF, CTA.
- The first 3 seconds MUST answer: "Why should I continue watching?"
- HOOK: Use 2-3 very short rapid-fire scenes (1-2 seconds each) with "cut" transitions and dynamic "camera_motion" to build immediate tension. Formula: [scenario] + [question].
- ESCALATION: Build tension or curiosity.
- EXPLANATION: 1-2 fact scenes — extreme brevity, highly surprising.
- PAYOFF: A "wait, that means..." moment that connects to everyday life.
- CTA: "Follow for a new mind-blowing fact every day."
- No clickbait or false claims (extract key facts into the claims array).
- visual_intent: High level visual concept.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. DO NOT use single abstract keywords.
- camera_motion: Pick one: "static", "zoom_in", "zoom_out", "pan_left", "pan_right", "ken_burns". Use dynamic motion for the HOOK.
- transition: Pick one: "cut", "fade", "dip_to_black", "wipe".
- emotion: The primary emotion.
- visual_effect: Special effect if needed (e.g. "shake", "flash") or empty string.
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK".
""",
    "tech_mysteries": """You are a scriptwriter for a technology mysteries YouTube {content_type} channel.

Write a sharp, intelligent script about: {topic}

Rules:
- Target duration: {target_duration_seconds} seconds at a fast speaking pace.
- Structure your script exactly as: HOOK, ESCALATION, EXPLANATION, PAYOFF, CTA.
- The first 3 seconds MUST answer: "Why should I continue watching?"
- HOOK: Use 2-3 very short rapid-fire scenes (1-2 seconds each) with "cut" transitions and dynamic "camera_motion" to build immediate tension. Formula: [scenario] + [question].
- ESCALATION: Raise the stakes of the mystery.
- EXPLANATION: 1-2 body scenes explaining the mechanism simply and quickly.
- PAYOFF: The "aha" moment of understanding.
- CTA: "Follow for more tech secrets you never knew."
- Accurate — no speculation presented as fact (extract facts to claims array).
- visual_intent: High level visual concept.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete.
- camera_motion: Pick one: "static", "zoom_in", "zoom_out", "pan_left", "pan_right", "ken_burns".
- transition: Pick one: "cut", "fade", "dip_to_black", "wipe".
- emotion: The primary emotion.
- visual_effect: Special effect if needed.
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
    custom_prompt: str | None = None,
    target_audience: str | None = None,
    tone: str | None = None,
    format_type: str | None = None,
) -> tuple:
    """
    Generate a structured script for the given topic.
    Returns (story_spec, provider_used, cost_data).
    """
    if custom_prompt or tone or target_audience or format_type:
        template = "You are an expert scriptwriter.\n"
        if custom_prompt:
            template += f"User instructions: {custom_prompt}\n"
        if tone:
            template += f"Tone: {tone}\n"
        if target_audience:
            template += f"Target Audience: {target_audience}\n"
        if format_type:
            template += f"Format: {format_type}\n"

        template += """
Write a highly engaging script about: {topic}

Rules:
- Target duration: {target_duration_seconds} seconds when read aloud.
- Structure your script exactly as: HOOK, ESCALATION, EXPLANATION, PAYOFF, CTA.
- The first 3 seconds MUST answer: "Why should I continue watching?"
- HOOK: Use 2-3 very short rapid-fire scenes (1-2 seconds each) with "cut" transitions and dynamic "camera_motion" to build immediate tension.
- NO unsupported claims (extract key facts into the claims array).
- visual_intent: A high level visual concept for the scene.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete.
- camera_motion: Pick one: "static", "zoom_in", "zoom_out", "pan_left", "pan_right", "ken_burns".
- transition: Pick one: "cut", "fade", "dip_to_black", "wipe".
- emotion: The primary emotion.
- visual_effect: Special effect if needed.
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK" unless impossible to find.
"""
    else:
        template = _PROMPTS.get(niche, _DEFAULT_PROMPT)

    if language != "en":
        template += f"\n- MUST write the script entirely in language code: {language}\n"

    if content_type == "long_form":
        template += f"""
- This is a LONG-FORM video ({target_duration_seconds} seconds / ~{target_duration_seconds // 60} minutes).
- Structure: COLD OPEN → INTRO → 3-5 CHAPTERS → CONCLUSION → CTA
- Each chapter should have 2-4 scenes with distinct narration blocks.
- Generate 12-25 scenes total (proportional to duration).
- Each scene narration should be 2-4 sentences (15-30 seconds spoken).
- Include chapter transitions ("But here's where it gets interesting...")
- Every 3 minutes, re-hook the audience with a pattern interrupt.
- COLD OPEN: Start with the most shocking/curious part of the story (first 15 seconds).
- INTRO: Set context after the cold open (30-45 seconds).
- CONCLUSION: Tie everything together with a memorable takeaway.
- CTA: "Subscribe and hit the bell for more deep dives like this."
"""

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
