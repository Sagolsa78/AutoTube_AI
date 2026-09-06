"""
Quality checker — scores a script before production starts.
Returns a score 0-100 and a list of issues.
Works with both legacy (hook/body/payoff) and scene-based script formats.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field


@dataclass
class QualityReport:
    score: float
    passed: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


_BANNED_KIDS = [
    r"\bscar(ed|y|ing)\b", r"\bkill\b", r"\bdead\b", r"\bdie\b",
    r"\bblood\b", r"\bhurt\b", r"\bweapon\b", r"\bgun\b", r"\bwar\b",
    r"\bfight\b", r"\bchase\b",
]


def _word_count(text: str) -> int:
    return len(text.split())


def _estimated_duration(text: str, wpm: int = 135) -> float:
    return _word_count(text) / wpm * 60


def check_script(script: dict, niche: str = "science_wow", threshold: float = 70.0) -> QualityReport:
    issues: list[str] = []
    suggestions: list[str] = []
    score = 100.0

    scenes = script.get("scenes", [])
    full_text = script.get("full_text", "")

    # If no full_text, build from scenes
    if not full_text and scenes:
        full_text = " ".join(s.get("narration", "") for s in scenes)

    # ── Scene-based checks ────────────────────────────────────────────────────

    if scenes:
        # 1. Must have at least 2 scenes (hook + content)
        if len(scenes) < 2:
            issues.append("Too few scenes — need at least a hook and a payoff")
            score -= 15

        # 2. First scene should be a strong hook (≥ 5 words)
        first_narration = scenes[0].get("narration", "")
        if not first_narration:
            issues.append("First scene (hook) has no narration")
            score -= 20
        elif len(first_narration.split()) < 5:
            issues.append("Hook scene too short (< 5 words)")
            score -= 10
            suggestions.append("Expand the hook to be more engaging")

        # 3. Each scene should have a visual description
        scenes_without_visuals = [
            i+1 for i, s in enumerate(scenes) 
            if not s.get("visual_description") and not s.get("visual_intent") and not s.get("stock_query")
        ]
        if scenes_without_visuals:
            issues.append(f"Scene(s) {scenes_without_visuals} missing visual descriptions")
            score -= 5 * len(scenes_without_visuals)

        # 4. Too many scenes = rushed feeling
        if len(scenes) > 6:
            issues.append("Too many scenes (>6) — will feel rushed at short duration")
            score -= 8
            suggestions.append("Trim to 3-5 scenes for better pacing")

    else:
        # ── Legacy hook/body/payoff checks ────────────────────────────────────
        hook     = script.get("hook", "")
        body     = script.get("body", [])
        payoff   = script.get("payoff", "")
        cta      = script.get("cta", "")

        if not hook:
            issues.append("Missing hook")
            score -= 20
        elif len(hook.split()) < 5:
            issues.append("Hook too short (< 5 words)")
            score -= 10
            suggestions.append("Expand the hook to be more engaging")

        if not body:
            issues.append("No body content")
            score -= 15
        elif len(body) > 6:
            issues.append("Body has too many sentences — will feel rushed")
            score -= 8
            suggestions.append("Trim body to 3-4 punchy sentences")

        if not cta:
            issues.append("No call-to-action")
            score -= 10

        if not payoff:
            issues.append("No payoff/conclusion")
            score -= 10

    # ── Universal checks ──────────────────────────────────────────────────────

    # Duration estimate
    if full_text:
        est = _estimated_duration(full_text)
        if est < 20:
            issues.append(f"Script too short (~{est:.0f}s) — minimum 25s")
            score -= 15
        elif est > 65:
            issues.append(f"Script too long (~{est:.0f}s) — maximum 60s")
            score -= 10
            suggestions.append("Remove one scene to tighten pacing")

    # Kids content safety check
    if niche == "kids_facts" and full_text:
        for pattern in _BANNED_KIDS:
            if re.search(pattern, full_text, re.IGNORECASE):
                issues.append(f"Unsafe content for kids: matched pattern '{pattern}'")
                score -= 25

    # Repetition check — first and last narration shouldn't be too similar
    if scenes and len(scenes) >= 2:
        first_words = set(scenes[0].get("narration", "").lower().split()[:5])
        last_words  = set(scenes[-1].get("narration", "").lower().split()[:5])
        overlap = first_words & last_words
        if len(overlap) >= 3:
            issues.append("First and last scenes sound too similar — add variety")
            score -= 10

    score = max(0.0, score)
    return QualityReport(
        score=round(score, 1),
        passed=score >= threshold,
        issues=issues,
        suggestions=suggestions,
    )
