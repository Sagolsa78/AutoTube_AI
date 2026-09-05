from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.db.database import get_db
from backend.models.models import Asset, Scene, Script
from engine.visuals.fetcher import async_search_clips

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
    
    return {"status": "success", "asset_id": asset.id}
