import logging
import json
import re
from typing import Optional, Tuple
from .schemas import StorySpec
from .validator import StoryValidator
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)

class StoryPlanner:
    """Plans and generates the StorySpec using AI providers with retry logic."""
    
    def __init__(self, max_retries: int = 2):
        self.max_retries = max_retries
        
    def _extract_json(self, raw: str) -> dict:
        """Strip markdown fences and parse JSON."""
        cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
        # Find the first { and last } to handle extra text
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1 and start_idx <= end_idx:
            cleaned = cleaned[start_idx:end_idx+1]
        return json.loads(cleaned)

    def generate_story(
        self,
        topic: str,
        prompt_template: str,
        preferred_provider: Optional[str] = None,
        preferred_model: Optional[str] = None,
        **kwargs
    ) -> Tuple[StorySpec, str]:
        """
        Generates a validated StorySpec.
        Returns a tuple of (StorySpec, provider_used).
        """
        schema_dict = StorySpec.model_json_schema()
        schema_json = json.dumps(schema_dict, indent=2)
        prompt = prompt_template.format(topic=topic, **kwargs)
        
        # Append schema requirements to the prompt
        system_instruction = (
            "\n\nYou MUST respond ONLY with a valid JSON object matching the following JSON Schema. "
            "Do not include markdown fences or explanation text outside the JSON.\n\n"
            f"{schema_json}\n"
        )
        full_prompt = prompt + system_instruction

        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                log.info(f"Generating StorySpec (attempt {attempt + 1}/{self.max_retries + 1})")
                raw_response, provider = generate_with_fallback(
                    full_prompt,
                    preferred_provider=preferred_provider,
                    preferred_model=preferred_model
                )
                
                parsed_data = self._extract_json(raw_response)
                
                # Ensure the story has a topic and valid scenes
                if "topic" not in parsed_data:
                    parsed_data["topic"] = topic
                    
                story_spec = StoryValidator.validate_story_dict(parsed_data)
                
                # Post-validation logic
                if not story_spec.scenes:
                    raise ValueError("Generated StorySpec has no scenes.")
                
                log.info(f"Successfully generated and validated StorySpec using {provider}")
                return story_spec, provider
                
            except (json.JSONDecodeError, ValueError) as e:
                log.warning(f"Failed to parse or validate StorySpec on attempt {attempt + 1}: {e}")
                last_error = e
            except Exception as e:
                log.error(f"Unexpected error during StorySpec generation: {e}")
                last_error = e
                
        raise RuntimeError(f"Failed to generate valid StorySpec after {self.max_retries + 1} attempts. Last error: {last_error}")
