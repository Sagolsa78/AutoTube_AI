from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class Provider(ABC):
    """Base class for all providers."""

    name: str

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if the provider is configured and available."""
        pass


class LLMProvider(Provider):
    """Abstract interface for LLM (Large Language Model) text generation."""

    @abstractmethod
    def generate(
        self, prompt: str, model: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generates text given a prompt.

        Args:
            prompt: The input prompt.
            model: Optional model override.

        Returns:
            A tuple of (generated text, cost_data dict).
        """
        pass


class TTSProvider(Provider):
    """Abstract interface for Text-to-Speech generation."""

    @abstractmethod
    async def generate_voiceover(
        self, text: str, voice: str, audio_path: str, language: str = "en"
    ) -> Dict[str, Any]:
        """
        Generates voiceover audio and returns word boundary metadata.

        Args:
            text: The text to synthesize.
            voice: The requested voice ID.
            audio_path: The file path to save the output audio.
            language: The language code.

        Returns:
            Dict containing output paths, duration, and word_boundaries.
        """
        pass


class VisualProvider(Provider):
    """Abstract interface for AI Image and Video generation."""

    @abstractmethod
    async def generate_image(self, prompt: str, out_dir: str) -> Optional[str]:
        """
        Generates an image.

        Args:
            prompt: Visual description prompt.
            out_dir: Directory to save the output.

        Returns:
            Path to the generated image file, or None if failed.
        """
        pass

    @abstractmethod
    async def generate_video(self, prompt: str, out_dir: str) -> Optional[str]:
        """
        Generates a video clip.

        Args:
            prompt: Visual description prompt.
            out_dir: Directory to save the output.

        Returns:
            Path to the generated video file, or None if failed.
        """
        pass
