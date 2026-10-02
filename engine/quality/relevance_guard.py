"""
Relevance guard — Phase 15.
Evaluates if a candidate topic is relevant to the channel niche, audience, and avoids duplicates.
"""

import json
import logging
import re
from typing import Any, Dict

from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)


class RelevanceGuard:
    @staticmethod
    def check_relevance(
        topic: str,
        niche: str,
        audience: str,
        recent_topics: list[str],
    ) -> bool:
        """
        Runs an LLM-based relevance gate.
        Returns True if the topic is relevant and novel, False otherwise.
        """
        prompt = f"""You are a strict content relevance gatekeeper.
Topic: {topic}
Channel Niche: {niche}
Target Audience: {audience}
Recent Topics: {', '.join(recent_topics) if recent_topics else 'None'}

Evaluate if the Topic is appropriate for the Channel Niche and Target Audience, and ensure it is not too similar to any Recent Topics.
Respond ONLY with a JSON object in this exact format (no markdown fences):
{{
  "is_relevant": true,
  "reason": "Brief explanation"
}}
"""
        try:
            raw_response, _, _ = generate_with_fallback(prompt)
            cleaned = (
                re.sub(r"```(?:json)?", "", raw_response).strip().rstrip("```").strip()
            )
            start_idx = cleaned.find("{")
            end_idx = cleaned.rfind("}")
            if start_idx != -1 and end_idx != -1:
                cleaned = cleaned[start_idx : end_idx + 1]

            result = json.loads(cleaned)
            return result.get("is_relevant", True)
        except Exception as e:
            log.warning(f"Relevance guard failed: {e}")
            # Fail open if LLM is down
            return True
