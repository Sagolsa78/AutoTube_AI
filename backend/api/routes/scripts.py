"""
Scripts router — generate script from an approved idea, quality check, store.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Script, Idea, IdeaStatus, Channel

router = APIRouter()


class ScriptOut(BaseModel):
    id:             str
    idea_id:        str
    hook:           str | None
    body:           list | None
    payoff:         str | None
    cta:            str | None
    full_text:      str | None
    visual_prompts: list | None
    duration_est:   float | None
    quality_score:  float
    fact_check_ok:  bool
    provider_used:  str | None
    created_at:     str


@router.get("/", response_model=list[ScriptOut])
async def list_scripts(idea_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Script)
    if idea_id:
        q = q.where(Script.idea_id == idea_id)
    result = await db.execute(q)
    return [_fmt(s) for s in result.scalars().all()]


@router.post("/generate/{idea_id}", response_model=ScriptOut, status_code=201)
async def generate_script_for_idea(idea_id: str, db: AsyncSession = Depends(get_db)):
    """
    Generate a script for an approved idea.
    Runs LLM + quality check synchronously (fine for manual test phase).
    """
    idea = await db.get(Idea, idea_id)
    if not idea:
        raise HTTPException(404, "Idea not found")
    if idea.status not in (IdeaStatus.approved, IdeaStatus.pending):
        raise HTTPException(400, f"Idea status is '{idea.status}' — approve it first")

    # Get niche from channel
    channel = await db.get(Channel, idea.channel_id)
    niche = channel.niche if channel else "science_wow"

    # Run generation pipeline
    from engine.script.generator import generate_script
    from engine.quality.checker import check_script
    try:
        data    = generate_script(idea.topic, niche)
        report  = check_script(data, niche)
    except Exception as exc:
        raise HTTPException(500, f"Script generation failed: {exc}")

    script = Script(
        idea_id        = idea_id,
        hook           = data.get("hook"),
        body           = data.get("body"),
        payoff         = data.get("payoff"),
        cta            = data.get("cta"),
        full_text      = data.get("full_text"),
        visual_prompts = data.get("visual_prompts"),
        duration_est   = data.get("estimated_duration"),
        quality_score  = report.score,
        fact_check_ok  = report.passed,
        provider_used  = data.get("provider_used"),
    )
    db.add(script)
    idea.status = IdeaStatus.scripted
    await db.flush()
    return _fmt(script)


@router.get("/{script_id}", response_model=ScriptOut)
async def get_script(script_id: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(Script, script_id)
    if not s:
        raise HTTPException(404, "Script not found")
    return _fmt(s)


def _fmt(s: Script) -> dict:
    return {
        "id":             s.id,
        "idea_id":        s.idea_id,
        "hook":           s.hook,
        "body":           s.body,
        "payoff":         s.payoff,
        "cta":            s.cta,
        "full_text":      s.full_text,
        "visual_prompts": s.visual_prompts,
        "duration_est":   s.duration_est,
        "quality_score":  s.quality_score or 0.0,
        "fact_check_ok":  s.fact_check_ok or False,
        "provider_used":  s.provider_used,
        "created_at":     str(s.created_at),
    }
