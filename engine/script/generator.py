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
    "kids_facts": """You are a friendly, enthusiastic scriptwriter for a children's YouTube Shorts channel (audience: ages 4-10).

Write a SHORT, fun, and educational script about: {topic}

Rules:
- 15-25 seconds when read aloud at a fast pace (target_duration=30 max)
- Open with a single CURIOSITY HOOK scene (a question or surprising statement kids love)
- 1-2 ultra-short, simple body scenes — get straight to the point
- End with a satisfying WOW PAYOFF scene (the answer or the coolest part)
- Finish with a friendly CTA scene: "Follow us to learn more amazing stuff!"
- Plain, simple words — as if explaining to a 6-year-old
- NO scary, violent, or adult themes
- NO unsupported claims (claims must be verifiable)
- visual_intent: A high level visual concept for the scene.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. (e.g. "monarch butterfly close up wings")
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK" unless something is impossible to find.
""",

    "science_wow": """You are a scriptwriter for a science YouTube Shorts channel targeting curious adults and teens.

Write a punchy, mind-blowing script about: {topic}

Rules:
- 15-25 seconds when read aloud at a very fast pace (target_duration=30 max)
- First scene MUST be a punchy, powerful curiosity hook — zero preamble
- 1-2 fact scenes — extreme brevity, highly surprising
- End with a "wait, that means..." payoff scene that connects to everyday life
- CTA scene: "Follow for a new mind-blowing fact every day."
- No clickbait or false claims (extract key facts into the claims array)
- visual_intent: High level visual concept.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. DO NOT use single abstract keywords. (e.g. "tardigrade under electron microscope")
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK".
""",

    "tech_mysteries": """You are a scriptwriter for a technology mysteries YouTube Shorts channel.

Write a sharp, intelligent script about: {topic}

Rules:
- 15-25 seconds at a fast speaking pace (target_duration=30 max)
- Open with an ultra-short hook scene framed as a mystery
- 1-2 body scenes explaining the mechanism simply and quickly
- Payoff scene: the "aha" moment of understanding
- CTA scene: "Follow for more tech secrets you never knew."
- Accurate — no speculation presented as fact (extract facts to claims array)
- visual_intent: High level visual concept.
- stock_query: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration. MUST be concrete. (e.g. "wifi router signal animation")
- scene_number must be sequential starting at 1.
- preferred_visual_mode should generally be "STOCK".
""",
}

_DEFAULT_PROMPT = _PROMPTS["science_wow"]

def generate_script(topic: str, niche: str = "science_wow", language: str = "en") -> dict:
    """
    Generate a structured script for the given topic.
    Returns a dict with scenes/estimated_duration/provider_used/full_text.
    This maintains backward compatibility while using the new StorySpec underneath.
    """
    template = _PROMPTS.get(niche, _DEFAULT_PROMPT)
    if language != "en":
        template += f"\n- MUST write the script entirely in language code: {language}\n"
        
    planner = StoryPlanner(max_retries=2)
    
    story_spec, provider = planner.generate_story(topic=topic, prompt_template=template)
    
    # Calculate estimated duration based on full text length
    full_text = " ".join([s.narration for s in story_spec.scenes if s.narration])
    
    return story_spec, provider
