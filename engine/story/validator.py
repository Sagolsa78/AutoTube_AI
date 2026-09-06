import json
from .schemas import StorySpec

class StoryValidator:
    @staticmethod
    def validate_story_json(json_str: str) -> StorySpec:
        """Parse and validate a JSON string into a StorySpec."""
        try:
            return StorySpec.model_validate_json(json_str)
        except Exception as e:
            raise ValueError(f"Failed to validate StorySpec: {e}")
            
    @staticmethod
    def validate_story_dict(data: dict) -> StorySpec:
        """Validate a dictionary into a StorySpec."""
        try:
            return StorySpec.model_validate(data)
        except Exception as e:
            raise ValueError(f"Failed to validate StorySpec: {e}")
