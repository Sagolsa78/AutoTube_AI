"""
Scripts router — generate script from an approved idea, quality check, store.
Now produces scene-based scripts with per-scene narration and visual descriptions.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.models import Script, Idea, IdeaStatus, Channel, ScriptStatus, Scene

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class SceneOut(BaseModel):
    id: str
    scene_number: int
    narration: str
    visual_description: str
    asset_id: str | None = None

class ScriptOut(BaseModel):
    id:             str
    idea_id:        str
    scenes:         list[SceneOut]
    full_text:      str | None
    duration_est:   float | None
    quality_score:  float
    fact_check_ok:  bool
    provider_used:  str | None
    status:         str
    created_at:     str

class ScriptUpdateIn(BaseModel):
    """Allows editing full_text or individual scene narration/visual_description."""
    full_text: str | None = None
    scenes: list[dict] | None = None   # [{id, narration?, visual_description?}]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ScriptOut])
async def list_scripts(idea_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Script).options(selectinload(Script.scenes))
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
    if idea.status not in (IdeaStatus.promoted, IdeaStatus.pending):
        raise HTTPException(400, f"Idea status is '{idea.status}' — promote it first")

    # Get niche and language from channel
    channel = await db.get(Channel, idea.channel_id)
    niche = channel.niche if channel else "science_wow"
    language = channel.language if channel else "en"

    # Run generation pipeline
    from engine.script.generator import generate_script
    from engine.quality.checker import check_script
    from engine.research.verifier import FactVerifier
    try:
        story_spec, provider_used = generate_script(idea.topic, niche, language)
        full_text = " ".join([s.narration for s in story_spec.scenes if s.narration])
        duration_est = len(full_text.split()) / 135 * 60
        
        data = story_spec.model_dump()
        data["full_text"] = full_text
        report  = check_script(data, niche)
        
        # True fact checking
        verifier = FactVerifier()
        fact_check_ok = verifier.verify_story(story_spec, language)
            
    except Exception as exc:
        raise HTTPException(500, f"Script generation failed: {exc}")

    script = Script(
        idea_id        = idea_id,
        full_text      = full_text,
        duration_est   = duration_est,
        quality_score  = report.score,
        fact_check_ok  = fact_check_ok,
        provider_used  = provider_used,
        body           = story_spec.model_dump()
    )
    db.add(script)
    await db.flush()

    # Create Scene rows from LLM output
    for s_spec in story_spec.scenes:
        scene_obj = Scene(
            script_id=script.id,
            scene_number=s_spec.scene_number,
            narration=s_spec.narration,
            visual_description=s_spec.stock_query or s_spec.visual_intent,
        )
        db.add(scene_obj)

    idea.status = IdeaStatus.promoted
    await db.flush()

    # Reload with scenes
    q = select(Script).where(Script.id == script.id).options(selectinload(Script.scenes))
    res = await db.execute(q)
    script = res.scalars().first()

    return _fmt(script)


@router.get("/{script_id}", response_model=ScriptOut)
async def get_script(script_id: str, db: AsyncSession = Depends(get_db)):
    q = select(Script).where(Script.id == script_id).options(selectinload(Script.scenes))
    res = await db.execute(q)
    s = res.scalars().first()
    if not s:
        raise HTTPException(404, "Script not found")
    return _fmt(s)


@router.patch("/{script_id}", response_model=ScriptOut)
async def update_script(script_id: str, body: ScriptUpdateIn, db: AsyncSession = Depends(get_db)):
    """Inline editing of script text and individual scenes."""
    q = select(Script).where(Script.id == script_id).options(selectinload(Script.scenes))
    res = await db.execute(q)
    s = res.scalars().first()
    if not s:
        raise HTTPException(404, "Script not found")
    if s.status == ScriptStatus.used_in_render:
        raise HTTPException(400, "Cannot edit a script that is already used in a render.")

    if body.full_text is not None:
        s.full_text = body.full_text

    if body.scenes:
        scene_map = {sc.id: sc for sc in s.scenes}
        for patch in body.scenes:
            scene = scene_map.get(patch.get("id"))
            if not scene:
                continue
            if "narration" in patch:
                scene.narration = patch["narration"]
            if "visual_description" in patch:
                scene.visual_description = patch["visual_description"]
        # Rebuild full_text from scenes
        s.full_text = " ".join(sc.narration for sc in sorted(s.scenes, key=lambda x: x.scene_number) if sc.narration)

    await db.flush()
    return _fmt(s)


@router.post("/{script_id}/regenerate", response_model=ScriptOut)
async def regenerate_script(script_id: str, db: AsyncSession = Depends(get_db)):
    old_script = await db.get(Script, script_id)
    if not old_script:
        raise HTTPException(404, "Script not found")
    if old_script.status == ScriptStatus.used_in_render:
        raise HTTPException(400, "Cannot regenerate a script that is already used in a render.")
    
    old_script.status = ScriptStatus.discarded
    await db.flush()

    return await generate_script_for_idea(old_script.idea_id, db)


@router.post("/{script_id}/discard", response_model=ScriptOut)
async def discard_script(script_id: str, db: AsyncSession = Depends(get_db)):
    q = select(Script).where(Script.id == script_id).options(selectinload(Script.scenes))
    res = await db.execute(q)
    s = res.scalars().first()
    if not s:
        raise HTTPException(404, "Script not found")
    if s.status == ScriptStatus.used_in_render:
        raise HTTPException(400, "Cannot discard a script that is already used in a render.")
    
    s.status = ScriptStatus.discarded
    await db.flush()
    return _fmt(s)


def _fmt(s: Script) -> dict:
    scenes = []
    if hasattr(s, "scenes") and s.scenes:
        for sc in sorted(s.scenes, key=lambda x: x.scene_number):
            scenes.append({
                "id": sc.id,
                "scene_number": sc.scene_number,
                "narration": sc.narration or "",
                "visual_description": sc.visual_description or "",
                "asset_id": sc.asset_id,
            })
    return {
        "id":             s.id,
        "idea_id":        s.idea_id,
        "scenes":         scenes,
        "full_text":      s.full_text,
        "duration_est":   s.duration_est,
        "quality_score":  s.quality_score if s.quality_score is not None else 0.0,
        "fact_check_ok":  s.fact_check_ok if s.fact_check_ok is not None else False,
        "provider_used":  s.provider_used,
        "status":         s.status.value if hasattr(s.status, "value") else (s.status or "draft"),
        "created_at":     str(s.created_at),
    }
