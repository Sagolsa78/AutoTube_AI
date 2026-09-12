from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.db.database import get_db
from backend.models.models import Asset, Scene, Script, User
from backend.auth.dependencies import get_current_user
from engine.visuals.fetcher import async_search_clips
from backend.worker_router import dispatch_job, WorkerCapability
import uuid

router = APIRouter(prefix="/api/assets", tags=["Assets"])

@router.get("/search")
async def search_assets(query: str, count: int = 10, db: AsyncSession = Depends(get_db)):
    """Search for stock clips across providers."""
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
        
    try:
        results = await async_search_clips(query, count=count)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scenes/{scene_id}/assign")
async def assign_asset_to_scene(
    scene_id: str,
    asset_data: dict, # Expects the dict returned by search_assets
    db: AsyncSession = Depends(get_db)
):
    """
    Assign a searched asset to a scene. 
    If the asset is not in the database, it creates a cache entry.
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    source_asset_id = asset_data.get("source_asset_id")
    if not source_asset_id:
        raise HTTPException(status_code=400, detail="source_asset_id is required")
        
    # Check if we already have this asset tracked
    q = select(Asset).where(
        Asset.source == asset_data.get("source"),
        Asset.source_asset_id == source_asset_id
    )
    res = await db.execute(q)
    asset = res.scalars().first()
    
    if not asset:
        # Create a new asset entry (without downloading yet)
        asset = Asset(
            user_id=scene.user_id,
            script_id=None,
            source_asset_id=source_asset_id,
            asset_type="video_clip",
            source=asset_data.get("source"),
            url=asset_data.get("url"),
            thumbnail_url=asset_data.get("thumbnail_url"),
            license=asset_data.get("license"),
            asset_metadata=asset_data.get("asset_metadata")
        )
        db.add(asset)
        await db.flush()
        
    scene.asset_id = asset.id
    await db.commit()
    
    return {"status": "success", "message": "Asset cached and assigned", "asset_id": asset.id}

@router.post("/generate")
async def generate_asset(
    prompt: str,
    mode: str, # "IMAGE" or "VIDEO"
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Dispatches a job to the Local Worker to generate an AI Image or Video asset.
    Returns the Job ID so the frontend can poll its status.
    """
    if mode not in ["IMAGE", "VIDEO"]:
        raise HTTPException(status_code=400, detail="mode must be IMAGE or VIDEO")
        
    capability = WorkerCapability.IMAGE if mode == "IMAGE" else WorkerCapability.VIDEO
    
    job_id = str(uuid.uuid4())
    payload = {
        "prompt": prompt,
        "mode": mode
    }
    
    # Dispatch via Worker Router
    route_meta = await dispatch_job(
        job_id=job_id,
        capability=capability,
        payload=payload,
        db=db
    )
    
    # Store the DB Job
    from backend.models.models import Job as DBJob
    from datetime import datetime
    
    new_db_job = DBJob(
        id=job_id,
        user_id=user.id,
        capability=capability.value,
        status=route_meta["status"],
        payload=payload,
        worker_id=route_meta.get("worker_id"),
        worker_type=route_meta.get("worker_type", "local"),
        cost_usd=0.0,
        created_at=datetime.utcnow()
    )
    db.add(new_db_job)
    await db.commit()
    
    return {"status": "success", "job_id": job_id, "message": "Asset generation job dispatched"}
