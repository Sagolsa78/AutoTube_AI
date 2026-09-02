"""
AutoShorts Studio — FastAPI application entry point.
Start with: uvicorn backend.main:app --reload
"""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.db.database import init_db
from backend.api.routes import ideas, scripts, videos, channels, analytics, profile

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting AutoShorts Studio...")
    await init_db()
    log.info("Database ready.")
    yield
    log.info("Shutting down.")


app = FastAPI(
    title="AutoShorts Studio",
    description="Faceless YouTube Shorts automation pipeline",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded logos as static files
app.mount("/static/logos", StaticFiles(directory="storage/logos", check_dir=False), name="logos")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(profile.router,   prefix="/api/profile",   tags=["profile"])
app.include_router(channels.router,  prefix="/api/channels",  tags=["channels"])
app.include_router(ideas.router,     prefix="/api/ideas",     tags=["ideas"])
app.include_router(scripts.router,   prefix="/api/scripts",   tags=["scripts"])
app.include_router(videos.router,    prefix="/api/videos",    tags=["videos"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "service": "AutoShorts Studio", "version": "0.2.0"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
