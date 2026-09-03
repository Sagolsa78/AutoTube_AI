"""
AI Provider abstraction layer.
Priority order defined in settings.SCRIPT_PROVIDER_ORDER.
Each provider must implement generate(prompt: str) -> str.
"""
from __future__ import annotations
import logging
from abc import ABC, abstractmethod
from backend.settings import (
    GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY,
    OLLAMA_BASE_URL, OLLAMA_MODEL, SCRIPT_PROVIDER_ORDER
)

log = logging.getLogger(__name__)


class BaseProvider(ABC):
    name: str

    @abstractmethod
    def generate(self, prompt: str) -> str: ...

    def is_available(self) -> bool:
        return True


# ── Ollama (local, free) ──────────────────────────────────────────────────────

class OllamaProvider(BaseProvider):
    name = "ollama"

    def is_available(self) -> bool:
        try:
            import requests
            r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            return r.status_code == 200
        except Exception:
            return False

    def generate(self, prompt: str) -> str:
        import requests
        payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
        r = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=120)
        r.raise_for_status()
        return r.json()["response"].strip()


# ── Gemini ─────────────────────────────────────────────────────────────────────

class GeminiProvider(BaseProvider):
    name = "gemini"

    def is_available(self) -> bool:
        return bool(GEMINI_API_KEY)

    def generate(self, prompt: str) -> str:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
        )
        return response.text.strip()


# ── Groq ───────────────────────────────────────────────────────────────────────

class GroqProvider(BaseProvider):
    name = "groq"

    def is_available(self) -> bool:
        return bool(GROQ_API_KEY)

    def generate(self, prompt: str) -> str:
        # pyrefly: ignore [missing-import]
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content.strip()


# ── OpenRouter ─────────────────────────────────────────────────────────────────

class OpenRouterProvider(BaseProvider):
    name = "openrouter"

    def is_available(self) -> bool:
        return bool(OPENROUTER_API_KEY)

    def generate(self, prompt: str) -> str:
        # pyrefly: ignore [missing-import]
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
        resp = client.chat.completions.create(
            model="deepseek/deepseek-r1:free",
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content.strip()


# ── Fallback Chain ─────────────────────────────────────────────────────────────

_PROVIDER_MAP: dict[str, type[BaseProvider]] = {
    "ollama":      OllamaProvider,
    "gemini":      GeminiProvider,
    "groq":        GroqProvider,
    "openrouter":  OpenRouterProvider,
}


def generate_with_fallback(prompt: str) -> tuple[str, str]:
    """
    Try providers in the configured order.
    Returns (generated_text, provider_name_used).
    Raises RuntimeError if all providers fail.
    """
    for name in SCRIPT_PROVIDER_ORDER:
        cls = _PROVIDER_MAP.get(name)
        if cls is None:
            log.warning("Unknown provider '%s' in order list — skipping", name)
            continue
        provider = cls()
        if not provider.is_available():
            log.info("Provider '%s' not available — skipping", name)
            continue
        try:
            log.info("Trying provider: %s", name)
            result = provider.generate(prompt)
            log.info("Provider '%s' succeeded", name)
            return result, name
        except Exception as exc:
            log.warning("Provider '%s' failed: %s", name, exc)
    raise RuntimeError(
        f"All providers failed. Order attempted: {SCRIPT_PROVIDER_ORDER}"
    )
