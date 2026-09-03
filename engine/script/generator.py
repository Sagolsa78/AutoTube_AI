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
# IMPORTANT: The example visual_prompts in each template use << >> placeholders
# so the LLM cannot copy them verbatim. They must be replaced with
# topic-specific phrases from the actual content being written.

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
- visual_prompts: exactly 3 SPECIFIC 3-5 word search phrases for stock footage directly relevant to {topic}.
  Each phrase must describe something VISUALLY CONCRETE and UNIQUE to this specific topic.
  BAD (too generic): "nature", "child playing", "colorful background"
  GOOD (topic-specific): for butterflies → "monarch butterfly close up wings", "caterpillar spinning cocoon", "butterfly emerging from chrysalis"

Respond ONLY with valid JSON (no markdown fences) — replace <<EXAMPLE>> with real values:
{{
  "hook": "...",
  "body": ["...", "...", "..."],
  "payoff": "...",
  "cta": "Follow us to learn more amazing stuff!",
  "visual_prompts": ["<<SPECIFIC_VISUAL_1_FOR_{topic}>>", "<<SPECIFIC_VISUAL_2_FOR_{topic}>>", "<<SPECIFIC_VISUAL_3_FOR_{topic}>>"],
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
- visual_prompts: exactly 3 SPECIFIC 3-5 word search phrases for stock footage directly relevant to {topic}.
  Each phrase must describe something VISUALLY CONCRETE and UNIQUE to this specific topic.
  DO NOT use single abstract keywords. DO NOT copy the example values below.
  BAD: "glowing blue dna double helix", "scientist looking into microscope", "earth spinning in space" (these are GENERIC PLACEHOLDERS — never use them)
  GOOD (for tardigrades): "tardigrade under electron microscope", "water bear cryptobiosis closeup", "extreme survival organism space"
  GOOD (for neutron stars): "neutron star collision animation", "massive star collapsing supernova", "gravitational wave detection screen"

Respond ONLY with valid JSON (no markdown fences):
{{
  "hook": "...",
  "body": ["...", "...", "..."],
  "payoff": "...",
  "cta": "Follow for a new mind-blowing fact every day.",
  "visual_prompts": ["<<SPECIFIC_VISUAL_1_FOR_{topic}>>", "<<SPECIFIC_VISUAL_2_FOR_{topic}>>", "<<SPECIFIC_VISUAL_3_FOR_{topic}>>"],
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
- visual_prompts: exactly 3 SPECIFIC 3-5 word search phrases for stock footage directly relevant to {topic}.
  Each phrase must describe something VISUALLY CONCRETE and UNIQUE to this specific topic.
  DO NOT copy the example values below — replace with content-specific phrases.
  GOOD (for WiFi): "wifi router signal animation", "radio waves traveling through air", "router blinking lights closeup"

Respond ONLY with valid JSON (no markdown fences):
{{
  "hook": "...",
  "body": ["...", "...", "..."],
  "payoff": "...",
  "cta": "Follow for more tech secrets you never knew.",
  "visual_prompts": ["<<SPECIFIC_VISUAL_1_FOR_{topic}>>", "<<SPECIFIC_VISUAL_2_FOR_{topic}>>", "<<SPECIFIC_VISUAL_3_FOR_{topic}>>"],
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
    except (json.JSONDecodeError, ValueError) as exc:
        log.error(
            "Provider '%s' returned non-JSON response for topic='%s'. Raw output (first 300 chars): %s",
            provider, topic, raw[:300]
        )
        raise RuntimeError(
            f"LLM provider '{provider}' returned invalid JSON for topic '{topic}'. "
            f"Cannot safely generate visual_prompts — aborting to avoid bad footage selection. "
            f"JSON error: {exc}"
        ) from exc

    data["provider_used"] = provider
    data["topic"] = topic
    data["niche"] = niche

    # Validate visual_prompts — catch cases where the LLM returned the placeholder text
    prompts = data.get("visual_prompts", [])
    bad_placeholders = ["glowing blue dna double helix", "scientist looking into microscope",
                        "earth spinning in space", "glowing computer circuit board",
                        "person typing fast keyboard", "fiber optic cable flashing"]
    generic_count = sum(1 for p in prompts if any(bad in p.lower() for bad in bad_placeholders))
    if generic_count == len(prompts) and len(prompts) > 0:
        log.warning(
            "visual_prompts for topic='%s' appear to be template placeholders, not topic-specific. "
            "Generating fallback prompts from topic keywords.",
            topic
        )
        # Build minimal topic-derived prompts — better than copying template examples
        words = [w for w in topic.lower().split() if len(w) > 4][:3]
        data["visual_prompts"] = [
            f"{' '.join(words[:2])} closeup" if len(words) >= 2 else f"{topic} closeup",
            f"{topic} scientific animation",
            f"{topic} natural world",
        ]
        log.info("Fallback visual_prompts: %s", data["visual_prompts"])

    # Build full_text for TTS
    body_text = " ".join(data.get("body", []) if isinstance(data.get("body"), list) else [])
    data["full_text"] = " ".join(filter(None, [
        data.get("hook", ""),
        body_text,
        data.get("payoff", ""),
        data.get("cta", ""),
    ]))

    return data
