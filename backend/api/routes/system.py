"""
System diagnostics — safe runtime information for debugging local/live data mismatch.
Never returns secrets, passwords, tokens, connection strings, or credentials.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import settings
from backend.db.database import get_db
from backend.models.models import Channel, Idea, Job, Script, User, Video

router = APIRouter()


@router.get("/runtime")
async def get_runtime_diagnostics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return safe, non-secret runtime diagnostics.
    Makes local/live data mismatch immediately diagnosable.
    """
    # Count entities for the current user
    counts = {}
    for label, model in [
        ("channels", Channel),
        ("ideas", Idea),
        ("scripts", Script),
        ("videos", Video),
        ("jobs", Job),
    ]:
        try:
            result = await db.execute(
                select(func.count()).select_from(model).where(model.user_id == user.id)
            )
            counts[label] = result.scalar() or 0
        except Exception:
            counts[label] = -1

    # Get migration version safely
    migration_version = "unknown"
    try:
        result = await db.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        )
        row = result.first()
        if row:
            migration_version = row[0]
    except Exception:
        pass

    # Get DB schema name
    schema = "default"
    try:
        if "postgresql" in (settings.DATABASE_URL or ""):
            result = await db.execute(text("SELECT current_schema()"))
            row = result.first()
            if row:
                schema = row[0]
        elif "sqlite" in (settings.DATABASE_URL or ""):
            schema = "sqlite_main"
    except Exception:
        pass

    return {
        "environment": settings.APP_ENV,
        "app_mode": settings.APP_MODE,
        "git_commit": settings.git_commit,
        "db_identity_hash": settings.db_identity_hash,
        "schema": schema,
        "migration_version": migration_version,
        "storage_backend": settings.STORAGE_BACKEND,
        "user_id": user.id,
        "counts": counts,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
