"""
Quality checker — scores a script before production starts.
Returns a score 0-100 and a list of issues.
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

    hook     = script.get("hook", "")
    body     = script.get("body", [])
    payoff   = script.get("payoff", "")
    cta      = script.get("cta", "")
    full_text = script.get("full_text", "")

    # 1. Hook strength (−20 if weak)
    if not hook:
        issues.append("Missing hook")
        score -= 20
    elif len(hook.split()) < 5:
        issues.append("Hook too short (< 5 words)")
        score -= 10
        suggestions.append("Expand the hook to be more engaging")

    # 2. Body length (−15 if empty or too long)
    if not body:
        issues.append("No body content")
        score -= 15
    elif len(body) > 6:
        issues.append("Body has too many sentences — will feel rushed")
        score -= 8
        suggestions.append("Trim body to 3-4 punchy sentences")

    # 3. Duration estimate (−15 if out of range)
    if full_text:
        est = _estimated_duration(full_text)
        if est < 20:
            issues.append(f"Script too short (~{est:.0f}s) — minimum 25s")
            score -= 15
        elif est > 65:
            issues.append(f"Script too long (~{est:.0f}s) — maximum 60s")
            score -= 10
            suggestions.append("Remove one body sentence to tighten pacing")

    # 4. CTA present (−10 if missing)
    if not cta:
        issues.append("No call-to-action")
        score -= 10
    
    # 5. Kids content safety check (−25 per violation)
    if niche == "kids_facts":
        for pattern in _BANNED_KIDS:
            if re.search(pattern, full_text, re.IGNORECASE):
                issues.append(f"Unsafe content for kids: matched pattern '{pattern}'")
                score -= 25

    # 6. Repetition check (−10 if first and last sentence nearly identical)
    sentences = [hook] + (body if isinstance(body, list) else [body]) + [payoff]
    sentences = [s.strip().lower() for s in sentences if s]
    if len(sentences) >= 2:
        first_words = set(sentences[0].split()[:5])
        last_words  = set(sentences[-1].split()[:5])
        overlap = first_words & last_words
        if len(overlap) >= 3:
            issues.append("Hook and payoff sound too similar — add variety")
            score -= 10

    # 7. Payoff check
    if not payoff:
        issues.append("No payoff/conclusion")
        score -= 10

    score = max(0.0, score)
    return QualityReport(
        score=round(score, 1),
        passed=score >= threshold,
        issues=issues,
        suggestions=suggestions,
    )
