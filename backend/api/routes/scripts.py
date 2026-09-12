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
from backend.models.models import Script, Idea, IdeaStatus, Channel, ScriptStatus, Scene, User
from backend.auth.dependencies import get_current_user

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class SceneOut(BaseModel):
    id: str
    scene_number: int
    narration: str
    visual_description: str
    asset_id: str | None = None
    preferred_visual_mode: str | None = None
    generation_prompt: str | None = None
    visual_intent: str | None = None
    stock_query: str | None = None

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
    language:       str | None = None
    locale:         str | None = None
    claims:         list | None = None
    latest_video_status: str | None = None
    latest_video_error: str | None = None

class ScriptUpdateIn(BaseModel):
    """Allows editing full_text or individual scene narration/visual_description."""
    full_text: str | None = None
    scenes: list[dict] | None = None   # [{id, narration?, visual_description?, preferred_visual_mode?, generation_prompt?, visual_intent?, stock_query?}]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ScriptOut])
async def list_scripts(
    channel_id: str | None = None,
    idea_id: str | None = None, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    q = select(Script).join(Idea).join(Channel).where(Channel.user_id == user.id).options(
        selectinload(Script.scenes),
        selectinload(Script.videos)
    )
    if channel_id:
        q = q.where(Channel.id == channel_id)
    if idea_id:
        q = q.where(Script.idea_id == idea_id)
    result = await db.execute(q)
    return [_fmt(s) for s in result.scalars().all()]


@router.post("/generate/{idea_id}", response_model=ScriptOut, status_code=201)
async def generate_script_for_idea(
    idea_id: str, 
    language: str | None = None, 
    locale: str | None = None, 
    provider: str | None = None,
    model: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a script for an approved idea.
    Runs LLM + quality check synchronously (fine for manual test phase).
    """
    idea = await db.get(Idea, idea_id)
    if not idea:
        raise HTTPException(404, "Idea not found")
        
    channel = await db.get(Channel, idea.channel_id)
    if not channel or channel.user_id != user.id:
        raise HTTPException(404, "Idea not found")

    if idea.status not in (IdeaStatus.promoted, IdeaStatus.pending):
        raise HTTPException(400, f"Idea status is '{idea.status}' — promote it first")

    # Get niche and language from channel
    niche = channel.niche
    final_language = language or channel.language
    final_locale = locale or "US"
    preferred_prov = provider or user.preferred_ai_provider or settings.DEFAULT_AI_PROVIDER
    preferred_mod = model or user.preferred_ai_model or settings.DEFAULT_AI_MODEL

    # Run generation pipeline
    from engine.script.generator import generate_script
    from engine.quality.checker import check_script
    from engine.research.verifier import FactVerifier
    try:
        story_spec, provider_used = generate_script(
            idea.topic,
            niche=niche,
            language=final_language,
            provider=preferred_prov,
            model=preferred_mod
        )
        story_spec.language = final_language
        story_spec.locale = final_locale
        full_text = " ".join([s.narration for s in story_spec.scenes if s.narration])
        duration_est = len(full_text.split()) / 135 * 60
        
        data = story_spec.model_dump()
        data["full_text"] = full_text
        report  = check_script(data, niche)
        
        # True fact checking
        verifier = FactVerifier()
        fact_check_ok = verifier.verify_story(story_spec, final_language)
            
    except Exception as exc:
        raise HTTPException(500, f"Script generation failed: {exc}")

    script = Script(
        user_id        = user.id,
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
            user_id=user.id,
            script_id=script.id,
            scene_number=s_spec.scene_number,
            narration=s_spec.narration,
            visual_description=s_spec.stock_query or s_spec.visual_intent,
        )
        db.add(scene_obj)

    idea.status = IdeaStatus.promoted
    await db.flush()

    # Reload with scenes
    q = select(Script).where(Script.id == script.id).options(selectinload(Script.scenes), selectinload(Script.videos))
    res = await db.execute(q)
    script = res.scalars().first()

    return _fmt(script)


@router.get("/{script_id}", response_model=ScriptOut)
async def get_script(
    script_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    q = select(Script).join(Idea).join(Channel).where(Channel.user_id == user.id, Script.id == script_id).options(selectinload(Script.scenes), selectinload(Script.videos))
    res = await db.execute(q)
    s = res.scalars().first()
    if not s:
        raise HTTPException(404, "Script not found")
    return _fmt(s)


@router.patch("/{script_id}", response_model=ScriptOut)
async def update_script(
    script_id: str, 
    body: ScriptUpdateIn, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Inline editing of script text and individual scenes."""
    q = select(Script).join(Idea).join(Channel).where(Channel.user_id == user.id, Script.id == script_id).options(selectinload(Script.scenes), selectinload(Script.videos))
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
        s_body = s.body or {}
        
        if isinstance(s_body, list):
            spec_scenes = s_body
            is_list_body = True
        else:
            spec_scenes = s_body.get("scenes", [])
            is_list_body = False
        
        for patch in body.scenes:
            scene_id = patch.get("id")
            scene = scene_map.get(scene_id)
            if not scene:
                continue
            if "narration" in patch:
                scene.narration = patch["narration"]
            if "visual_description" in patch:
                scene.visual_description = patch["visual_description"]
            
            # Update the JSON body as well for advanced fields
            for i, spec_scene in enumerate(spec_scenes):
                if spec_scene.get("scene_number") == scene.scene_number:
                    if "preferred_visual_mode" in patch:
                        spec_scenes[i]["preferred_visual_mode"] = patch["preferred_visual_mode"]
                    if "generation_prompt" in patch:
                        spec_scenes[i]["generation_prompt"] = patch["generation_prompt"]
                    if "visual_intent" in patch:
                        spec_scenes[i]["visual_intent"] = patch["visual_intent"]
                    if "stock_query" in patch:
                        spec_scenes[i]["stock_query"] = patch["stock_query"]
                    if "narration" in patch:
                        spec_scenes[i]["narration"] = patch["narration"]
                    break
                        
        if is_list_body:
            s.body = spec_scenes
        else:
            s_body["scenes"] = spec_scenes
            s.body = s_body
        
        # Rebuild full_text from scenes
        s.full_text = " ".join(sc.narration for sc in sorted(s.scenes, key=lambda x: x.scene_number) if sc.narration)

    await db.flush()
    return _fmt(s)


@router.post("/{script_id}/regenerate", response_model=ScriptOut)
async def regenerate_script(
    script_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    q = select(Script).join(Idea).join(Channel).where(Channel.user_id == user.id, Script.id == script_id)
    res = await db.execute(q)
    old_script = res.scalars().first()
    
    if not old_script:
        raise HTTPException(404, "Script not found")
    if old_script.status == ScriptStatus.used_in_render:
        raise HTTPException(400, "Cannot regenerate a script that is already used in a render.")
    
    old_script.status = ScriptStatus.discarded
    await db.flush()

    return await generate_script_for_idea(old_script.idea_id, None, None, user, db)


@router.post("/{script_id}/discard", response_model=ScriptOut)
async def discard_script(
    script_id: str, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    q = select(Script).join(Idea).join(Channel).where(Channel.user_id == user.id, Script.id == script_id).options(selectinload(Script.scenes), selectinload(Script.videos))
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
    
    spec_scenes = {}
    language = "en"
    locale = "US"
    claims = []
    if s.body:
        if isinstance(s.body, dict):
            language = s.body.get("language", "en")
            locale = s.body.get("locale", "US")
            claims = s.body.get("claims", [])
            for sc in s.body.get("scenes", []):
                spec_scenes[sc.get("scene_number")] = sc
        elif isinstance(s.body, list):
            for sc in s.body:
                if isinstance(sc, dict):
                    spec_scenes[sc.get("scene_number")] = sc
            
    if hasattr(s, "scenes") and s.scenes:
        for sc in sorted(s.scenes, key=lambda x: x.scene_number):
            spec_sc = spec_scenes.get(sc.scene_number, {})
            scenes.append({
                "id": sc.id,
                "scene_number": sc.scene_number,
                "narration": sc.narration or "",
                "visual_description": sc.visual_description or "",
                "asset_id": sc.asset_id,
                "preferred_visual_mode": spec_sc.get("preferred_visual_mode", "STOCK"),
                "generation_prompt": spec_sc.get("generation_prompt", ""),
                "visual_intent": spec_sc.get("visual_intent", ""),
                "stock_query": spec_sc.get("stock_query", "")
            })
            
    latest_vid = None
    if hasattr(s, "videos") and s.videos:
        latest_vid = sorted(s.videos, key=lambda v: v.created_at, reverse=True)[0]
        
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
        "language":       language,
        "locale":         locale,
        "claims":         claims,
        "latest_video_status": latest_vid.status.value if (latest_vid and hasattr(latest_vid.status, "value")) else (latest_vid.status if latest_vid else None),
        "latest_video_error": latest_vid.notes if latest_vid else None
    }
