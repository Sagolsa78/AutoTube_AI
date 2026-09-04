"""
Script generator — builds a structured script from a topic + niche config.
Outputs JSON with a list of scenes.
"""
from __future__ import annotations
import json
import logging
import re
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)

# ── Prompt templates per niche ─────────────────────────────────────────────────

_PROMPTS: dict[str, str] = {
    "kids_facts": """You are a friendly, enthusiastic scriptwriter for a children's YouTube Shorts channel (audience: ages 4-10).

Write a SHORT, fun, and educational script about: {topic}

Rules:
- 15-25 seconds when read aloud at a fast pace
- Open with a single CURIOSITY HOOK scene (a question or surprising statement kids love)
- 1-2 ultra-short, simple body scenes — get straight to the point
- End with a satisfying WOW PAYOFF scene (the answer or the coolest part)
- Finish with a friendly CTA scene: "Follow us to learn more amazing stuff!"
- Plain, simple words — as if explaining to a 6-year-old
- NO scary, violent, or adult themes
- NO unsupported claims
- visual_description: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration.
  Each phrase must describe something VISUALLY CONCRETE and UNIQUE to this specific topic.
  BAD (too generic): "nature", "child playing", "colorful background"
  GOOD (topic-specific): for butterflies → "monarch butterfly close up wings"

Respond ONLY with valid JSON (no markdown fences). It must match exactly this structure:
{{
  "scenes": [
    {{"narration": "...", "visual_description": "..."}},
    {{"narration": "...", "visual_description": "..."}}
  ]
}}""",

    "science_wow": """You are a scriptwriter for a science YouTube Shorts channel targeting curious adults and teens.

Write a punchy, mind-blowing script about: {topic}

Rules:
- 15-25 seconds when read aloud at a very fast pace
- First scene MUST be a punchy, powerful curiosity hook — zero preamble
- 1-2 fact scenes — extreme brevity, highly surprising
- End with a "wait, that means..." payoff scene that connects to everyday life
- CTA scene: "Follow for a new mind-blowing fact every day."
- No clickbait or false claims
- visual_description: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration.
  Each phrase must describe something VISUALLY CONCRETE and UNIQUE to this specific topic.
  DO NOT use single abstract keywords. DO NOT copy the example values below.
  BAD: "glowing blue dna double helix", "scientist looking into microscope"
  GOOD (for tardigrades): "tardigrade under electron microscope", "water bear cryptobiosis closeup"

Respond ONLY with valid JSON (no markdown fences). It must match exactly this structure:
{{
  "scenes": [
    {{"narration": "...", "visual_description": "..."}},
    {{"narration": "...", "visual_description": "..."}}
  ]
}}""",

    "tech_mysteries": """You are a scriptwriter for a technology mysteries YouTube Shorts channel.

Write a sharp, intelligent script about: {topic}

Rules:
- 15-25 seconds at a fast speaking pace
- Open with an ultra-short hook scene framed as a mystery
- 1-2 body scenes explaining the mechanism simply and quickly
- Payoff scene: the "aha" moment of understanding
- CTA scene: "Follow for more tech secrets you never knew."
- Accurate — no speculation presented as fact
- visual_description: A SPECIFIC 3-5 word description for stock footage directly relevant to the narration.
  Each phrase must describe something VISUALLY CONCRETE and UNIQUE to this specific topic.
  GOOD (for WiFi): "wifi router signal animation", "radio waves traveling through air"

Respond ONLY with valid JSON (no markdown fences). It must match exactly this structure:
{{
  "scenes": [
    {{"narration": "...", "visual_description": "..."}},
    {{"narration": "...", "visual_description": "..."}}
  ]
}}""",
}

_DEFAULT_PROMPT = _PROMPTS["science_wow"]


def _extract_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
    return json.loads(cleaned)


def generate_script(topic: str, niche: str = "science_wow") -> dict:
    """
    Generate a structured script for the given topic.
    Returns a dict with scenes/estimated_duration/provider_used/full_text.
    """
    template = _PROMPTS.get(niche, _DEFAULT_PROMPT)
    prompt = template.format(topic=topic)

    raw, provider = generate_with_fallback(prompt)
    log.info("Script generated via %s for topic='%s'", provider, topic)

    try:
        data = _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        log.error(
            "Provider '%s' returned non-JSON response for topic='%s'. Raw output (first 300 chars): %s",
            provider, topic, raw[:300]
        )
        raise RuntimeError(
            f"LLM provider '{provider}' returned invalid JSON for topic '{topic}'. "
            f"JSON error: {exc}"
        ) from exc

    data["provider_used"] = provider
    data["topic"] = topic
    data["niche"] = niche

    # Validate scenes
    scenes = data.get("scenes", [])
    if not scenes:
        data["scenes"] = [
            {"narration": f"Did you know about {topic}?", "visual_description": f"{topic} close up"},
            {"narration": "It is truly fascinating.", "visual_description": f"{topic} in action"},
        ]
        
    for s in data["scenes"]:
        if "narration" not in s: s["narration"] = ""
        if "visual_description" not in s: s["visual_description"] = ""

    # Build full_text for TTS and duration estimation
    data["full_text"] = " ".join([s["narration"] for s in data["scenes"]])
    data["estimated_duration"] = len(data["full_text"].split()) / 135 * 60

    return data
