import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.db.database import get_db
from backend.models.models import CostEvent, DailyComputeSpend, Job, User

router = APIRouter()
log = logging.getLogger(__name__)


@router.get("/summary")
async def get_cost_summary(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns aggregated cost metrics for the dashboard.
    - Total spend this month
    - Spend by channel
    - Spend by operation/provider
    - Daily compute spend
    """
    user_id = user.id
    now = datetime.utcnow()
    start_of_month = datetime(now.year, now.month, 1)

    # 1. Total monthly spend
    monthly_spend_q = select(func.sum(CostEvent.estimated_cost)).where(
        CostEvent.user_id == user_id, CostEvent.created_at >= start_of_month
    )
    monthly_spend_res = await db.execute(monthly_spend_q)
    monthly_spend = monthly_spend_res.scalar() or 0.0

    # 2. Spend by channel (All time or monthly)
    channel_spend_q = (
        select(CostEvent.channel_id, func.sum(CostEvent.estimated_cost).label("total"))
        .where(CostEvent.user_id == user_id)
        .group_by(CostEvent.channel_id)
    )

    channel_res = await db.execute(channel_spend_q)
    by_channel = [
        {"channel_id": row.channel_id or "unassigned", "amount": row.total}
        for row in channel_res.all()
    ]

    # 3. Spend by operation
    op_spend_q = (
        select(CostEvent.operation, func.sum(CostEvent.estimated_cost).label("total"))
        .where(CostEvent.user_id == user_id)
        .group_by(CostEvent.operation)
    )

    op_res = await db.execute(op_spend_q)
    by_operation = [
        {"operation": row.operation or "unknown", "amount": row.total}
        for row in op_res.all()
    ]

    # 4. Daily compute spend (last 7 days)
    seven_days_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    daily_q = (
        select(DailyComputeSpend)
        .where(
            DailyComputeSpend.user_id == user_id,
            DailyComputeSpend.date >= seven_days_ago,
        )
        .order_by(DailyComputeSpend.date.asc())
    )

    daily_res = await db.execute(daily_q)
    daily_history = [
        {"date": r.date, "amount": r.amount_spent_usd, "jobs": r.jobs_count}
        for r in daily_res.scalars().all()
    ]

    return {
        "monthly_spend": round(monthly_spend, 4),
        "by_channel": by_channel,
        "by_operation": by_operation,
        "daily_history": daily_history,
    }


@router.get("/jobs/{job_id}")
async def get_job_costs(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns detailed cost events for a specific job.
    """
    job_q = select(Job).where(Job.id == job_id, Job.user_id == user.id)
    job_res = await db.execute(job_q)
    job = job_res.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events_q = (
        select(CostEvent)
        .where(CostEvent.job_id == job_id)
        .order_by(CostEvent.created_at.asc())
    )
    events_res = await db.execute(events_q)
    events = events_res.scalars().all()

    total_cost = sum(e.estimated_cost for e in events)

    return {
        "job_id": job.id,
        "total_cost": round(total_cost, 4),
        "events": [
            {
                "id": e.id,
                "stage": e.stage,
                "provider": e.provider,
                "model": e.model,
                "operation": e.operation,
                "tokens": e.tokens,
                "duration_seconds": e.duration_seconds,
                "estimated_cost": e.estimated_cost,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }
