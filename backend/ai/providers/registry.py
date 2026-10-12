from typing import Any, Dict, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

from backend.settings import (
    GEMINI_API_KEY,
    GROQ_API_KEY,
    OLLAMA_BASE_URL,
    OPENROUTER_API_KEY,
)

# Model Routing Policy
MODEL_POLICY = {
    "IDEAS": "fast",
    "HOOKS": "fast",
    "OUTLINE": "reasoning",
    "FINAL_SCRIPT": "reasoning",
    "RESEARCH": "reasoning",
    "CRITIQUE": "fast",
    "SEO": "fast",
    "VISUAL": "fast",
    "LOCAL": "local",
}


def get_model(
    policy_type: str = "fast", provider_fallback: Optional[str] = None
) -> BaseChatModel:
    """
    Returns an instantiated LangChain ChatModel based on the policy type.
    Policy types: 'fast', 'reasoning', 'local'
    """
    if policy_type == "fast":
        if GEMINI_API_KEY:
            # Using latest supported Gemini Flash as per instructions
            return ChatGoogleGenerativeAI(
                model="gemini-3.5-flash", google_api_key=GEMINI_API_KEY, temperature=0.7
            )
        elif GROQ_API_KEY:
            return ChatGroq(
                model="llama3-8b-8192", groq_api_key=GROQ_API_KEY, temperature=0.7
            )

    elif policy_type == "reasoning":
        if GEMINI_API_KEY:
            # Using 3.1-pro-preview as per prompt instructions
            return ChatGoogleGenerativeAI(
                model="gemini-3.1-pro-preview",
                google_api_key=GEMINI_API_KEY,
                temperature=0.7,
            )
        elif GROQ_API_KEY:
            return ChatGroq(
                model="llama3-70b-8192", groq_api_key=GROQ_API_KEY, temperature=0.7
            )

    elif policy_type == "local":
        return ChatOpenAI(
            base_url=f"{OLLAMA_BASE_URL}/v1", api_key="ollama", model="qwen2.5-coder:7b"
        )

    # Ultimate fallback to OpenRouter if configured
    if OPENROUTER_API_KEY:
        return ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            model="google/gemini-flash-1.5",
        )

    raise ValueError(f"No valid provider configured for policy type: {policy_type}")
