from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field, field_validator, model_validator
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
    RUNTIME_ROLE: Literal["api", "worker"] = "api"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./storage/autoshorts.db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 20

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
    GITHUB_REPO: str = Field(
        default="Sagolsa78/AutoTube_AI",
        validation_alias=AliasChoices("GITHUB_REPO", "GITHUB_REPOSITORY"),
    )
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
    COVERR_API_KEY: Optional[str] = None
    PEXELS_API_KEY: Optional[str] = None
    PIXABAY_API_KEY: Optional[str] = None

    # ── Visual Generation ─────────────────────────────────────────────────────
    COMFYUI_URL: str = "http://127.0.0.1:8188"

    # ── Authentication & Security ─────────────────────────────────────────────
    # Determines if API endpoints require authentication
    AUTH_DISABLED: bool = False
    AUTOTUBE_API_KEY: Optional[str] = None
    JWT_SECRET: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    # Fernet key for encrypting OAuth tokens at rest (32 url-safe base64 bytes).
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: Optional[str] = None
    YOUTUBE_REDIRECT_URI: Optional[str] = None

    # ── Default Active AI Model ───────────────────────────────────────────────
    DEFAULT_AI_PROVIDER: str = "gemini"
    DEFAULT_AI_MODEL: str = "gemini-3.5-flash-lite"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.APP_ENV == "production":
            missing = []

            if self.RUNTIME_ROLE == "api":
                if (
                    not self.JWT_SECRET
                    or self.JWT_SECRET == "autotube-super-secret-jwt-signing-key-2026"
                ):
                    missing.append("JWT_SECRET")
                if self.CORS_ORIGINS == "*":
                    missing.append("CORS_ORIGINS (cannot be '*' in production)")
                if not self.ENCRYPTION_KEY:
                    missing.append("ENCRYPTION_KEY")

            if not self.WORKER_SECRET:
                missing.append("WORKER_SECRET")
            if not self.DATABASE_URL:
                missing.append("DATABASE_URL")
            if self.DATABASE_URL and "sqlite" in self.DATABASE_URL.lower():
                missing.append("DATABASE_URL (SQLite is not allowed in production)")

            if missing:
                raise ValueError(
                    f"Missing or invalid mandatory production secrets: {', '.join(missing)}"
                )
        return self

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

    @property
    def db_identity_hash(self) -> str:
        """Non-secret hash derived from DB connection identity for local/live diagnostics."""
        import hashlib

        url = self.DATABASE_URL or ""
        if "sqlite" in url.lower():
            # For SQLite, use the file path as identity
            return hashlib.sha256(f"sqlite:{url}".encode()).hexdigest()[:16]
        parsed = urlparse(url)
        identity = f"{parsed.hostname}:{parsed.port or 5432}/{parsed.path}"
        return hashlib.sha256(identity.encode()).hexdigest()[:16]

    @property
    def git_commit(self) -> str:
        """Return current git commit hash if available."""
        import subprocess as _sp

        try:
            return (
                _sp.check_output(
                    ["git", "rev-parse", "--short", "HEAD"],
                    stderr=_sp.DEVNULL,
                    cwd=str(Path(__file__).resolve().parent.parent.parent),
                )
                .decode()
                .strip()
            )
        except Exception:
            return "unknown"


# Global settings instance
settings = Settings()
