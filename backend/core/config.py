from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized configuration for AutoTube AI.
    Loads from environment variables or .env file.
    """

    # ── Application ───────────────────────────────────────────────────────────
    APP_ENV: Literal["development", "production", "test"] = "development"
    APP_MODE: Literal["local", "cloud"] = "local"
    LOG_LEVEL: str = "INFO"

    # Allowed origins for CORS (comma-separated string parsed to list in main.py)
    CORS_ORIGINS: str = "*"
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./storage/autoshorts.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def sanitize_database_url(cls, v: str) -> str:
        if not v:
            return v
        # Normalize driver scheme for async engines
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and not v.startswith(
            "postgresql+asyncpg://"
        ):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif v.startswith("sqlite://") and not v.startswith("sqlite+aiosqlite://"):
            v = v.replace("sqlite://", "sqlite+aiosqlite://", 1)

        # For asyncpg, sanitize query parameters
        if "postgresql+asyncpg://" in v:
            parsed = urlparse(v)
            query_params = parse_qsl(parsed.query)
            new_params = []
            for k, val in query_params:
                # asyncpg uses ssl, not sslmode
                if k == "sslmode":
                    new_params.append(("ssl", val))
                # asyncpg does not accept channel_binding
                elif k == "channel_binding":
                    continue
                else:
                    new_params.append((k, val))
            new_query = urlencode(new_params)
            v = urlunparse(
                (
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    parsed.params,
                    new_query,
                    parsed.fragment,
                )
            )
        return v

    # ── Storage ───────────────────────────────────────────────────────────────
    STORAGE_BACKEND: Literal["local", "s3", "r2"] = Field(
        default="local",
        validation_alias=AliasChoices("STORAGE_BACKEND", "STORAGE_PROVIDER"),
    )
    STORAGE_ROOT: str = "storage"

    # S3 / R2 Configuration
    S3_ENDPOINT_URL: Optional[str] = None
    S3_BUCKET_NAME: str = "autoshorts-assets"
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    R2_PUBLIC_DOMAIN: Optional[str] = None

    # ── Workers & Compute ─────────────────────────────────────────────────────
    WORKER_BACKEND: Literal["local", "github_actions"] = "local"
    DAILY_GPU_BUDGET_CAP: float = 2.00
    COMPUTE_STRATEGY: str = "local-first"
    ZERO_LAPTOP_MODE: bool = False
    RUNPOD_API_KEY: Optional[str] = None

    # GitHub Actions (for cloud worker)
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_REPOSITORY: Optional[str] = None
    WORKER_GIT_REF: str = "main"  # git ref used by GitHub Actions worker
    WORKER_SECRET: Optional[str] = None  # shared secret for worker-API authentication

    # ── AI Providers ──────────────────────────────────────────────────────────
    # Ordered list of providers for fallback chain
    SCRIPT_PROVIDER_ORDER: str = "gemini,groq,openrouter,ollama"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5-coder:7b"
    OLLAMA_MODELS: str = "qwen2.5-coder:7b"  # comma-separated fallback list
    OLLAMA_TIMEOUT: int = Field(
        default=60, validation_alias=AliasChoices("OLLAMA_TIMEOUT")
    )

    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None

    # ── Stock Footage Providers ───────────────────────────────────────────────
    STOCK_PROVIDER_ORDER: str = "pexels,coverr,pixabay"
    COVERR_ENABLED: bool = True
    PEXELS_API_KEY: Optional[str] = None
    PIXABAY_API_KEY: Optional[str] = None

    # ── Visual Generation ─────────────────────────────────────────────────────
    COMFYUI_URL: str = "http://127.0.0.1:8188"

    # ── Authentication & Security ─────────────────────────────────────────────
    # Determines if API endpoints require authentication
    AUTH_DISABLED: bool = False
    AUTOTUBE_API_KEY: Optional[str] = None
    JWT_SECRET: str = "autotube-super-secret-jwt-signing-key-2026"
    JWT_ALGORITHM: str = "HS256"
    # Fernet key for encrypting OAuth tokens at rest (32 url-safe base64 bytes).
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: Optional[str] = None
    YOUTUBE_REDIRECT_URI: Optional[str] = None

    # ── Default Active AI Model ───────────────────────────────────────────────
    DEFAULT_AI_PROVIDER: str = "gemini"
    DEFAULT_AI_MODEL: str = "gemini-3.5-flash-lite"

    # ── GitHub / Cloud Worker ─────────────────────────────────────────────────
    GITHUB_REPO: str = "Sagolsa78/AutoTube_AI"  # owner/repo for dispatch

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def STORAGE_PROVIDER(self) -> str:
        return self.STORAGE_BACKEND

    @property
    def YOUTUBE_CLIENT_SECRETS(self):
        """Path to the YouTube OAuth client secrets JSON file."""
        base = Path(__file__).resolve().parent.parent.parent
        secret_file = os.getenv("YOUTUBE_CLIENT_SECRETS", "client_secret.json")
        return base / secret_file

    @property
    def parsed_cors_origins(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def parsed_script_provider_order(self) -> list[str]:
        seen = set()
        order = []
        for p in self.SCRIPT_PROVIDER_ORDER.split(","):
            cleaned = p.strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                order.append(cleaned)
        return order

    @property
    def parsed_stock_provider_order(self) -> list[str]:
        seen = set()
        order = []
        for p in self.STOCK_PROVIDER_ORDER.split(","):
            cleaned = p.strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                order.append(cleaned)
        return order


# Global settings instance
settings = Settings()
