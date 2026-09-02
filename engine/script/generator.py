"""
Script generator — builds a structured script from a topic + niche config.
Outputs JSON with hook / body / payoff / cta / visual_prompts.
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
- 30-50 seconds when read aloud at a gentle pace
- Open with a single CURIOSITY HOOK sentence (a question or surprising statement kids love)
- 3-4 short, simple body sentences — one idea each, no jargon
- End with a satisfying WOW PAYOFF (the answer or the coolest part)
- Finish with a friendly CTA: "Follow us to learn more amazing stuff!"
- Plain, simple words — as if explaining to a 6-year-old
- NO scary, violent, or adult themes
- NO unsupported claims
- visual_prompts must contain 3 exact 3-4 word visually concrete search phrases (e.g. "child holding plastic skull" or "animated smiling sun") NOT generic nouns.

Respond ONLY with valid JSON (no markdown fences) in this exact format:
{{
  "hook": "...",
  "body": ["...", "...", "..."],
  "payoff": "...",
  "cta": "Follow us to learn more amazing stuff!",
  "visual_prompts": ["happy child exploring nature", "colorful plastic dinosaur toy", "kid looking through telescope"],
  "estimated_duration": 40
}}""",

    "science_wow": """You are a scriptwriter for a science YouTube Shorts channel targeting curious adults and teens.

Write a punchy, mind-blowing script about: {topic}

Rules:
- 35-55 seconds when read aloud at normal pace
- First line MUST be a powerful curiosity hook — no preamble
- 3-4 fact sentences — each must be genuinely surprising and accurate
- End with a "wait, that means..." payoff that connects to everyday life
- CTA: "Follow for a new mind-blowing fact every day."
- No clickbait or false claims
- No markdown, no stage directions
- visual_prompts must contain exactly 3 specific, visually concrete 3-4 word search phrases for stock footage (e.g. "glowing blue brain scan", "astronaut walking on moon", "close up falling water") — DO NOT use single abstract keywords.

Respond ONLY with valid JSON (no markdown fences):
{{
  "hook": "...",
  "body": ["...", "...", "..."],
  "payoff": "...",
  "cta": "Follow for a new mind-blowing fact every day.",
  "visual_prompts": ["glowing blue dna double helix", "scientist looking into microscope", "earth spinning in space"],
  "estimated_duration": 45
}}""",

    "tech_mysteries": """You are a scriptwriter for a technology mysteries YouTube Shorts channel.

Write a sharp, intelligent script about: {topic}

Rules:
- 35-50 seconds at normal speaking pace
- Open with a hook framed as a mystery or something the viewer uses daily without understanding
- 3-4 body sentences explaining the mechanism clearly but simply
- Payoff: the "aha" moment of understanding
- CTA: "Follow for more tech secrets you never knew."
- Accurate — no speculation presented as fact
- visual_prompts must contain exactly 3 specific, visually concrete 3-4 word search phrases for stock footage (e.g. "circuit board glowing blue", "person typing on keyboard", "fiber optic cables flashing") — DO NOT use single abstract keywords.

Respond ONLY with valid JSON (no markdown fences):
{{
  "hook": "...",
  "body": ["...", "...", "..."],
  "payoff": "...",
  "cta": "Follow for more tech secrets you never knew.",
  "visual_prompts": ["glowing computer circuit board", "person typing fast keyboard", "fiber optic cable flashing"],
  "estimated_duration": 43
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
    Returns a dict with hook/body/payoff/cta/visual_prompts/estimated_duration/provider_used.
    """
    template = _PROMPTS.get(niche, _DEFAULT_PROMPT)
    prompt = template.format(topic=topic)

    raw, provider = generate_with_fallback(prompt)
    log.info("Script generated via %s for topic='%s'", provider, topic)

    try:
        data = _extract_json(raw)
    except json.JSONDecodeError:
        log.warning("Failed to parse JSON from provider — returning raw text")
        # Graceful degradation: wrap as plain script
        sentences = [s.strip() for s in raw.split(".") if s.strip()]
        data = {
            "hook": sentences[0] if sentences else topic,
            "body": sentences[1:-1] if len(sentences) > 2 else sentences,
            "payoff": sentences[-1] if len(sentences) > 1 else "",
            "cta": "Follow for more!",
            "visual_prompts": [f"{topic} stock footage", "interesting background loop"],
            "estimated_duration": 40,
        }

    data["provider_used"] = provider
    data["topic"] = topic
    data["niche"] = niche

    # Build full_text for TTS
    body_text = " ".join(data.get("body", []))
    data["full_text"] = " ".join(filter(None, [
        data.get("hook", ""),
        body_text,
        data.get("payoff", ""),
        data.get("cta", ""),
    ]))

    return data
