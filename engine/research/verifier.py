import json
import logging
from typing import List
from engine.story.schemas import StorySpec, Claim, Evidence
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)

class FactVerifier:
    """Verifies factual claims in a StorySpec."""
    
    def __init__(self, max_retries: int = 1):
        self.max_retries = max_retries

    def verify_story(self, story_spec: StorySpec, language: str = "en") -> bool:
        """
        Iterates over all claims in the story and attempts to verify them.
        Returns True if all high/medium importance claims pass verification.
        Mutates the story_spec in-place to attach Evidence.
        """
        if not story_spec.claims:
            log.info("No claims to verify.")
            return True
            
        all_passed = True
        for claim in story_spec.claims:
            passed = self._verify_claim(claim, story_spec.topic, language)
            if not passed and claim.importance in ["high", "medium"]:
                log.warning(f"Failed to verify important claim: {claim.text}")
                all_passed = False
                
        return all_passed

    def _verify_claim(self, claim: Claim, topic: str, language: str) -> bool:
        """Verifies a single claim using LLM parametric knowledge."""
        lang_instruction = f"\nRespond in language code: {language}" if language != "en" else ""
        
        prompt = f"""You are a strict, objective factual verifier.
Topic: {topic}
Claim: {claim.text}

Your task is to determine if this claim is factually accurate based on established facts.
If it is accurate, provide a brief piece of evidence (like a reference to a known scientific fact, historical event, or general knowledge).
If it is inaccurate, provide evidence refuting it.{lang_instruction}

Respond ONLY with a JSON object in this exact format (no markdown fences):
{{
  "is_accurate": true,
  "support_score": 0.9,
  "source_title": "General Knowledge / Specific domain (e.g. Biology, History)",
  "excerpt": "Brief explanation of why the claim is true or false."
}}
"""
        for attempt in range(self.max_retries + 1):
            try:
                raw_response, provider = generate_with_fallback(prompt)
                
                # Strip markdown
                import re
                cleaned = re.sub(r"```(?:json)?", "", raw_response).strip().rstrip("```").strip()
                start_idx = cleaned.find("{")
                end_idx = cleaned.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    cleaned = cleaned[start_idx:end_idx+1]
                
                result = json.loads(cleaned)
                
                evidence = Evidence(
                    source_url="llm_parametric_memory",
                    title=result.get("source_title", "LLM Verification"),
                    publisher=provider,
                    excerpt=result.get("excerpt", ""),
                    support_score=result.get("support_score", 0.0)
                )
                
                claim.evidence.append(evidence)
                
                is_accurate = result.get("is_accurate", False)
                claim.confidence = evidence.support_score if is_accurate else 0.0
                
                return is_accurate and evidence.support_score >= 0.7
                
            except Exception as e:
                log.warning(f"Claim verification attempt {attempt + 1} failed: {e}")
                
        log.error(f"Failed to verify claim after retries: {claim.text}")
        return False
