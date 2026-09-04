from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.db.database import get_db
from backend.models.models import Video, Publication, Analytics

router = APIRouter()

@router.get("/")
async def get_dashboard_analytics(db: AsyncSession = Depends(get_db)):
    """
    Returns aggregated analytics for the dashboard.
    In a real app, this would sync with YouTube API.
    For now, it calculates from the local DB.
    """
    # Total uploaded videos
    pub_q = select(Publication).where(Publication.status == "live")
    pubs = (await db.execute(pub_q)).scalars().all()
    
    total_views = 0
    total_subs = 0
    for pub in pubs:
        # get analytics
        an_q = select(Analytics).where(Analytics.video_id == pub.video_id)
        an = (await db.execute(an_q)).scalars().first()
        if an:
            total_views += an.views
            total_subs += an.subscribers
            
    # Mock data for demonstration if empty
    if not pubs:
        return {
            "subscribers": 0,
            "shorts_views_90d": 0,
            "ypp_sub_goal": 1000,
            "ypp_view_goal": 10000000
        }
        
    return {
        "subscribers": total_subs,
        "shorts_views_90d": total_views,
        "ypp_sub_goal": 1000,
        "ypp_view_goal": 10000000
    }
