"""
AutoShorts Studio — FastAPI application entry point.
Start with: uvicorn backend.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

# pyrefly: ignore [missing-import]
from fastapi import FastAPI

# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes import (
    analytics,
    assets,
    auth,
    channels,
    costs,
    health,
    ideas,
    integrations,
    jobs,
    profile,
    scripts,
    system,
    videos,
    voices,
    youtube,
)
from backend.core.config import settings
from backend.db.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting AutoTube AI...")
    await init_db()
    log.info("Database ready.")

    from backend.jobs.auto_scheduler import start_auto_scheduler, stop_auto_scheduler
    from backend.jobs.publish_scheduler import (
        start_publish_scheduler,
        stop_publish_scheduler,
    )

    start_publish_scheduler()
    start_auto_scheduler()

    # Local worker is now a separate standalone process: python -m backend.worker.main
    yield
    stop_auto_scheduler()
    stop_publish_scheduler()
    log.info("Shutting down.")


app = FastAPI(
    title="AutoShorts Studio",
    description="Faceless YouTube Shorts automation pipeline",
    version="0.2.0",
    lifespan=lifespan,
)

origins = settings.parsed_cors_origins if settings.parsed_cors_origins else []

if settings.APP_ENV == "production" and (not origins or "*" in origins):
    raise RuntimeError(
        "CORS origins must be strictly configured in production. Wildcards are not allowed."
    )

if not origins:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded logos as static files
app.mount(
    "/static/logos",
    StaticFiles(directory="storage/logos", check_dir=False),
    name="logos",
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
app.include_router(ideas.router, prefix="/api/ideas", tags=["ideas"])
app.include_router(scripts.router, prefix="/api/scripts", tags=["scripts"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(assets.router)
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(voices.router, prefix="/api/voices", tags=["voices"])
app.include_router(costs.router, prefix="/api/costs", tags=["costs"])
app.include_router(health.router, prefix="/api/system/health", tags=["health"])
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(
    integrations.router, prefix="/api/integrations", tags=["integrations"]
)

from backend.api.routes import calendar, publishing

app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(publishing.router)


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "service": "AutoShorts Studio", "version": "0.2.0"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
