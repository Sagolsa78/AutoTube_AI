from __future__ import annotations
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_system_health():
    # Hardcode for now, but mock real provider telemetry data
    providers = [
        {
            "name": "Ollama",
            "type": "LLM",
            "status": "online",
            "model": "llama3.2",
            "endpoint": "localhost:11434",
            "tier": "Local",
            "quota": "Unlimited",
            "note": "Primary script generation. Runs locally — no rate limits.",
            "priority": 1,
        },
        {
            "name": "Google Gemini",
            "type": "LLM",
            "status": "online",
            "model": "gemini-3.5-flash-lite",
            "endpoint": "generativelanguage.googleapis.com",
            "tier": "Free",
            "quota": "15 RPM / 1M TPD",
            "note": "Fallback #1. Rate-limited on free tier.",
            "priority": 2,
        },
        {
            "name": "Groq",
            "type": "LLM",
            "status": "online",
            "model": "llama-3.3-70b-versatile",
            "endpoint": "api.groq.com",
            "tier": "Free",
            "quota": "30 RPM / 14.4K RPD",
            "note": "Fallback #2. Very fast inference but strict daily caps.",
            "priority": 3,
        },
        {
            "name": "OpenRouter",
            "type": "LLM",
            "status": "limited",
            "model": "Various",
            "endpoint": "openrouter.ai",
            "tier": "Free",
            "quota": "Model-dependent",
            "note": "Fallback #3 (last resort). Pay-per-use above free credits.",
            "priority": 4,
        },
        {
            "name": "Edge-TTS",
            "type": "TTS",
            "status": "online",
            "model": "en-US-ChristopherNeural",
            "endpoint": "Microsoft Edge (local)",
            "tier": "Free",
            "quota": "Unlimited",
            "note": "Text-to-speech. No API key required.",
            "priority": 1,
        },
        {
            "name": "Pexels",
            "type": "Stock Footage",
            "status": "online",
            "model": "—",
            "endpoint": "api.pexels.com",
            "tier": "Free",
            "quota": "200 req/hr",
            "note": "Primary stock footage source for visual clips.",
            "priority": 1,
        },
        {
            "name": "Pixabay",
            "type": "Stock Footage",
            "status": "offline",
            "model": "—",
            "endpoint": "pixabay.com/api",
            "tier": "Free",
            "quota": "5000/day",
            "note": "Backup footage source. API key not configured.",
            "priority": 2,
        },
        {
            "name": "YouTube Data API",
            "type": "Upload",
            "status": "online",
            "model": "—",
            "endpoint": "youtube.googleapis.com",
            "tier": "OAuth",
            "quota": "10K units/day",
            "note": "Video upload + metadata. 1600 units per upload.",
            "priority": 1,
        },
    ]
    return providers
