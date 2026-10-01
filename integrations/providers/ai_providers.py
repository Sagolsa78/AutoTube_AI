"""
AI Provider abstraction layer.
Priority order defined in settings.SCRIPT_PROVIDER_ORDER.
Each provider must implement generate(prompt: str) -> str.
"""

from __future__ import annotations

import logging
import os

from backend.settings import (
    GEMINI_API_KEY,
    GROQ_API_KEY,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_MODELS,
    OLLAMA_TIMEOUT,
    OPENROUTER_API_KEY,
    SCRIPT_PROVIDER_ORDER,
)
from integrations.providers.base import LLMProvider

log = logging.getLogger(__name__)


# ── Ollama (local, free) ──────────────────────────────────────────────────────


class OllamaProvider(LLMProvider):
    name = "ollama"

    def _pulled_models(self) -> list[str]:
        """Return list of all locally pulled Ollama model full names and base names."""
        try:
            import requests

            r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            if r.status_code != 200:
                return []
            models = []
            for m in r.json().get("models", []):
                full_name = m.get("name", "")
                if full_name and not any(
                    x in full_name.lower()
                    for x in ["qwen3.5", "wen3.5", "qwen 3.5", "3.5"]
                ):
                    models.append(full_name)
                    models.append(full_name.split(":")[0])
            return list(set(models))
        except Exception:
            return []

    def is_available(self) -> bool:
        pulled = self._pulled_models()
        if not pulled:
            return False
        # Available if any model is pulled or configured
        return True

    def generate(self, prompt: str, model: str | None = None) -> tuple[str, dict]:
        import requests

        pulled = self._pulled_models()

        candidates = []
        if model:
            candidates.append(model)
            if ":" in model:
                candidates.append(model.split(":")[0])

        # Add configured OLLAMA_MODELS
        candidates.extend(OLLAMA_MODELS)

        # Filter to models that exist in pulled (or try all if pulled check was empty)
        if pulled:
            valid_candidates = [
                m for m in candidates if m in pulled or m.split(":")[0] in pulled
            ]
            if not valid_candidates:
                # Fall back to any pulled model
                valid_candidates = [m for m in pulled if ":" in m] or pulled
            candidates = valid_candidates

        if not candidates:
            raise RuntimeError(f"No Ollama models available on {OLLAMA_BASE_URL}")

        last_exc = None
        # Remove duplicates while preserving order
        seen = set()
        deduped_candidates = [x for x in candidates if not (x in seen or seen.add(x))]
        ollama_timeout = int(OLLAMA_TIMEOUT or os.getenv("OLLAMA_TIMEOUT", "45"))

        for cand in deduped_candidates:
            try:
                log.info(
                    "Ollama: querying model '%s' (timeout=%ss)", cand, ollama_timeout
                )
                payload = {
                    "model": cand,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "60m",
                }
                r = requests.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=payload,
                    timeout=ollama_timeout,
                )
                r.raise_for_status()
                log.info("Ollama: model '%s' succeeded", cand)
                text = r.json().get("response", "").strip()
                tokens = int(
                    r.json().get("eval_count", len(text) // 4 + len(prompt) // 4)
                )
                cost = 0.0  # Local is free
                cost_data = {
                    "provider": "ollama",
                    "model": cand,
                    "tokens": tokens,
                    "estimated_cost": cost,
                }
                return text, cost_data
            except Exception as e:
                log.warning("Ollama: model '%s' failed: %s", cand, e)
                last_exc = e
        raise RuntimeError(f"All Ollama models failed: {last_exc}")


# ── Gemini ─────────────────────────────────────────────────────────────────────


class GeminiProvider(LLMProvider):
    name = "gemini"

    # Known stable models in priority order:
    # 3.5-flash-lite has massive rate limits / free quotas; 3.5-flash is ultra-fast; flash-lite-latest is resilient
    FALLBACK_MODELS = [
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
    ]

    def is_available(self) -> bool:
        return bool(GEMINI_API_KEY)

    def generate(self, prompt: str, model: str | None = None) -> tuple[str, dict]:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)

        # Build candidate models starting with preferred model
        preferred = model or "gemini-3.5-flash-lite"
        candidates = [preferred]
        for alt in self.FALLBACK_MODELS:
            if alt not in candidates:
                candidates.append(alt)

        last_err = None
        for cand in candidates:
            try:
                log.info("Gemini: querying model '%s'", cand)
                response = client.models.generate_content(
                    model=cand,
                    contents=prompt,
                )
                if response.text:
                    log.info("Gemini: model '%s' succeeded", cand)
                    text = response.text.strip()
                    usage = getattr(response, "usage_metadata", None)
                    tokens = (
                        usage.total_token_count
                        if usage
                        else len(text) // 4 + len(prompt) // 4
                    )
                    # Rough estimate for Flash: $0.075 / 1M input + $0.30 / 1M output ~ $0.15 / 1M total
                    cost = tokens * 0.00000015
                    cost_data = {
                        "provider": "gemini",
                        "model": cand,
                        "tokens": tokens,
                        "estimated_cost": cost,
                    }
                    return text, cost_data
            except Exception as e:
                err_str = str(e)
                log.warning(
                    "Gemini: model '%s' failed (%s). Trying next alternative...",
                    cand,
                    err_str,
                )
                last_err = e
                # Continue loop to try alternative model (e.g. if 3.6-flash hit quota/429 or 2.5-flash hit 404)

        raise RuntimeError(f"All Gemini models failed: {last_err}")


# ── Groq ───────────────────────────────────────────────────────────────────────


class GroqProvider(LLMProvider):
    name = "groq"

    def is_available(self) -> bool:
        return bool(GROQ_API_KEY)

    def generate(self, prompt: str, model: str | None = None) -> tuple[str, dict]:
        from groq import Groq

        client = Groq(api_key=GROQ_API_KEY)
        chosen_model = model or "llama-3.3-70b-versatile"
        resp = client.chat.completions.create(
            model=chosen_model,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.choices[0].message.content.strip()
        tokens = (
            resp.usage.total_tokens if resp.usage else len(text) // 4 + len(prompt) // 4
        )
        # Rough estimate for Groq Llama 3 70B: $0.59 / 1M input + $0.79 / 1M output ~ $0.70 / 1M total
        cost = tokens * 0.0000007
        cost_data = {
            "provider": "groq",
            "model": chosen_model,
            "tokens": tokens,
            "estimated_cost": cost,
        }
        return text, cost_data


# ── OpenRouter ─────────────────────────────────────────────────────────────────


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def is_available(self) -> bool:
        return bool(OPENROUTER_API_KEY)

    def generate(self, prompt: str, model: str | None = None) -> tuple[str, dict]:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
        chosen_model = model or "deepseek/deepseek-r1:free"
        resp = client.chat.completions.create(
            model=chosen_model,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.choices[0].message.content.strip()
        tokens = (
            resp.usage.total_tokens
            if hasattr(resp, "usage") and resp.usage
            else len(text) // 4 + len(prompt) // 4
        )
        # DeepSeek R1 free is free
        cost = 0.0
        cost_data = {
            "provider": "openrouter",
            "model": chosen_model,
            "tokens": tokens,
            "estimated_cost": cost,
        }
        return text, cost_data


# ── Fallback Chain & Diagnostics ───────────────────────────────────────────────

_PROVIDER_MAP: dict[str, type[LLMProvider]] = {
    "ollama": OllamaProvider,
    "gemini": GeminiProvider,
    "groq": GroqProvider,
    "openrouter": OpenRouterProvider,
}


def get_available_models() -> dict:
    """
    Returns live diagnostics of available models and provider connectivity.
    """
    import requests

    ollama_models = []
    ollama_online = False
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        if r.status_code == 200:
            ollama_online = True
            ollama_models = [
                m.get("name", "")
                for m in r.json().get("models", [])
                if m.get("name")
                and not any(
                    x in m.get("name", "").lower()
                    for x in ["qwen3.5", "wen3.5", "qwen 3.5", "3.5"]
                )
            ]
    except Exception:
        ollama_online = False

    providers = {
        "ollama": {
            "name": "Ollama (Local)",
            "type": "local",
            "available": ollama_online and len(ollama_models) > 0,
            "models": ollama_models or ["qwen2.5-coder:7b"],
            "selected_model": "qwen2.5-coder:7b",
        },
        "gemini": {
            "name": "Google Gemini",
            "type": "cloud",
            "available": bool(GEMINI_API_KEY),
            "models": [
                "gemini-3.5-flash-lite",
                "gemini-3.6-flash",
                "gemini-3.5-flash",
            ],
            "selected_model": "gemini-3.5-flash-lite",
        },
        "groq": {
            "name": "Groq Llama 3.3",
            "type": "cloud",
            "available": bool(GROQ_API_KEY),
            "models": ["llama-3.3-70b-versatile"],
            "selected_model": "llama-3.3-70b-versatile",
        },
        "openrouter": {
            "name": "OpenRouter DeepSeek",
            "type": "cloud",
            "available": bool(OPENROUTER_API_KEY),
            "models": ["deepseek/deepseek-r1:free"],
            "selected_model": "deepseek/deepseek-r1:free",
        },
    }
    return providers


def generate_with_fallback(
    prompt: str,
    preferred_provider: str | None = None,
    preferred_model: str | None = None,
) -> tuple[str, str, dict]:
    """
    Try providers starting with preferred_provider / preferred_model,
    then falling back to the configured provider order.
    Returns (generated_text, provider_name_used).
    """
    seen = set()
    order = [
        p
        for p in SCRIPT_PROVIDER_ORDER
        if p in _PROVIDER_MAP and not (p in seen or seen.add(p))
    ]
    if preferred_provider and preferred_provider in _PROVIDER_MAP:
        if preferred_provider in order:
            order.remove(preferred_provider)
        order.insert(0, preferred_provider)

    last_error = None
    for name in order:
        cls = _PROVIDER_MAP.get(name)
        if cls is None:
            continue
        provider = cls()
        if not provider.is_available():
            continue
        try:
            log.info("Trying AI provider '%s'", name)
            model_arg = preferred_model if name == preferred_provider else None
            # pyrefly: ignore [call-arg]
            result, cost_data = provider.generate(prompt, model=model_arg)
            log.info("AI provider '%s' succeeded", name)
            return result, name, cost_data
        except Exception as exc:
            log.warning("AI provider '%s' failed: %s", name, exc)
            last_error = exc

    raise RuntimeError(
        f"All AI providers failed. Attempted: {order}. Last error: {last_error}"
    )
