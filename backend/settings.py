"""
AutoShorts — Shared application settings (Legacy Bridge).
WARNING: This file is deprecated. Use `backend.core.config.settings` instead.
"""
from __future__ import annotations
from pathlib import Path
from backend.core.config import settings

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent
STORAGE    = BASE_DIR / settings.STORAGE_ROOT
AUDIO_DIR  = STORAGE / "audio"
VISUAL_DIR = STORAGE / "visuals"
RENDER_DIR = STORAGE / "renders"
PROJECT_DIR= STORAGE / "projects"

for d in (AUDIO_DIR, VISUAL_DIR, RENDER_DIR, PROJECT_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── Database ──────────────────────────────────────────────────────────────────
# Connection string conversions and cleanups are now handled externally or in config
DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

if "sslmode=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("sslmode=", "ssl=")

import re
DATABASE_URL = re.sub(r"&?channel_binding=[^&]+", "", DATABASE_URL)
DATABASE_URL = re.sub(r"\?$", "", DATABASE_URL)

# ── AI Providers ──────────────────────────────────────────────────────────────
GEMINI_API_KEY       = settings.GEMINI_API_KEY or ""
GROQ_API_KEY         = settings.GROQ_API_KEY or ""
OPENROUTER_API_KEY   = settings.OPENROUTER_API_KEY or ""
OLLAMA_BASE_URL      = settings.OLLAMA_BASE_URL
OLLAMA_MODEL         = settings.OLLAMA_MODEL

SCRIPT_PROVIDER_ORDER = settings.parsed_script_provider_order

# ── Stock Footage ─────────────────────────────────────────────────────────────
PEXELS_API_KEY   = settings.PEXELS_API_KEY or ""
PIXABAY_API_KEY  = settings.PIXABAY_API_KEY or ""

# ── YouTube ───────────────────────────────────────────────────────────────────
import os
YOUTUBE_CLIENT_SECRETS = BASE_DIR / os.getenv("YOUTUBE_CLIENT_SECRETS", "client_secret.json")
YOUTUBE_TOKEN_FILE     = BASE_DIR / "token.json"

# ── App ───────────────────────────────────────────────────────────────────────
APP_ENV   = settings.APP_ENV
LOG_LEVEL = settings.LOG_LEVEL
