"""
AutoShorts — Shared application settings (Legacy Bridge).
WARNING: This file is deprecated. Use `backend.core.config.settings` instead.
"""

from __future__ import annotations

from pathlib import Path

from backend.core.config import settings

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE = BASE_DIR / settings.STORAGE_ROOT
AUDIO_DIR = STORAGE / "audio"
VISUAL_DIR = STORAGE / "visuals"
RENDER_DIR = STORAGE / "renders"
PROJECT_DIR = STORAGE / "projects"

for d in (AUDIO_DIR, VISUAL_DIR, RENDER_DIR, PROJECT_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── Database ──────────────────────────────────────────────────────────────────
# URL normalization is handled in config.py's field_validator — do not re-apply here.
DATABASE_URL = settings.DATABASE_URL

# ── AI Providers ──────────────────────────────────────────────────────────────
GEMINI_API_KEY = settings.GEMINI_API_KEY or ""
GROQ_API_KEY = settings.GROQ_API_KEY or ""
OPENROUTER_API_KEY = settings.OPENROUTER_API_KEY or ""
OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL
OLLAMA_MODEL = settings.OLLAMA_MODEL
OLLAMA_MODELS = [m.strip() for m in settings.OLLAMA_MODELS.split(",") if m.strip()]
OLLAMA_TIMEOUT = settings.OLLAMA_TIMEOUT
SCRIPT_PROVIDER_ORDER = settings.parsed_script_provider_order

# ── Stock Footage ─────────────────────────────────────────────────────────────
PEXELS_API_KEY = settings.PEXELS_API_KEY or ""
PIXABAY_API_KEY = settings.PIXABAY_API_KEY or ""

# ── YouTube ───────────────────────────────────────────────────────────────────
import os

YOUTUBE_CLIENT_SECRETS = BASE_DIR / os.getenv(
    "YOUTUBE_CLIENT_SECRETS", "client_secret.json"
)

# ── App ───────────────────────────────────────────────────────────────────────
APP_ENV = settings.APP_ENV
LOG_LEVEL = settings.LOG_LEVEL
