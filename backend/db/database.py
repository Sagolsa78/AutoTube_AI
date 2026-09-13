"""
Async database engine + session factory.
"""
import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.exc import OperationalError
from backend.models.models import Base
from backend.core.config import settings

log = logging.getLogger(__name__)

# Basic pool configuration
engine_kwargs = {
    "echo": False,
    "future": True,
}

# Add pool settings for PostgreSQL
if "postgresql" in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_pre_ping": True,           # verify connections before use
        "pool_recycle": 180,             # recycle connections every 3 min (Neon sleeps)
        "pool_timeout": 30,              # wait up to 30s for a pool connection
    })
    if "-pooler" in settings.DATABASE_URL or "pooler" in settings.DATABASE_URL:
        engine_kwargs["connect_args"] = {"statement_cache_size": 0}

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """
    Initialize database connection.
    Schema migrations are handled strictly by Alembic, NOT by create_all().
    Run: alembic upgrade head
    """
    log.info("Checking database connectivity...")
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # Verify connection is alive
            await conn.execute(text("SELECT 1"))
            log.info("Database connectivity verified.")
    except Exception as e:
        log.error(f"Failed to connect to database: {e}")
        raise


async def get_db():
    """FastAPI dependency — yields an async session with retry on transient failures."""
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            async with AsyncSessionLocal() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise
            return  # success — exit retry loop
        except OperationalError as exc:
            err_str = str(exc).lower()
            is_transient = any(k in err_str for k in (
                "name resolution", "could not connect", "connection refused",
                "connection reset", "ssl", "timeout", "temporary failure"
            ))
            if is_transient and attempt < max_retries:
                wait = 2 ** attempt  # 2s, 4s
                log.warning(
                    "DB connection transient error (attempt %d/%d), retrying in %ds: %s",
                    attempt, max_retries, wait, exc
                )
                await asyncio.sleep(wait)
                continue
            raise  # non-transient or exhausted retries

