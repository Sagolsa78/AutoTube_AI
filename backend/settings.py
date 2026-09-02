"""
AutoShorts — Shared application settings.
Reads from the .env file via python-dotenv.
"""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent
STORAGE    = BASE_DIR / os.getenv("STORAGE_ROOT", "storage")
AUDIO_DIR  = STORAGE / "audio"
VISUAL_DIR = STORAGE / "visuals"
RENDER_DIR = STORAGE / "renders"
PROJECT_DIR= STORAGE / "projects"

for d in (AUDIO_DIR, VISUAL_DIR, RENDER_DIR, PROJECT_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{STORAGE}/autoshorts.db")

# ── AI Providers ──────────────────────────────────────────────────────────────
GEMINI_API_KEY       = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY         = os.getenv("GROQ_API_KEY", "")
OPENROUTER_API_KEY   = os.getenv("OPENROUTER_API_KEY", "")
OLLAMA_BASE_URL      = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL         = os.getenv("OLLAMA_MODEL", "llama3.2")

SCRIPT_PROVIDER_ORDER = [
    p.strip()
    for p in os.getenv("SCRIPT_PROVIDER_ORDER", "ollama,gemini,groq,openrouter").split(",")
    if p.strip()
]

# ── Stock Footage ─────────────────────────────────────────────────────────────
PEXELS_API_KEY   = os.getenv("PEXELS_API_KEY", "")
PIXABAY_API_KEY  = os.getenv("PIXABAY_API_KEY", "")

# ── YouTube ───────────────────────────────────────────────────────────────────
YOUTUBE_CLIENT_SECRETS = BASE_DIR / os.getenv("YOUTUBE_CLIENT_SECRETS", "client_secret.json")
YOUTUBE_TOKEN_FILE     = BASE_DIR / "token.json"

# ── App ───────────────────────────────────────────────────────────────────────
APP_ENV   = os.getenv("APP_ENV", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
