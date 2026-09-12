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
        "pool_recycle": 300,             # recycle connections every 5 min (Neon sleeps)
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
    """
    log.info("Checking database connectivity and schema...")
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # Check connection
            await conn.run_sync(lambda sync_conn: None)
            
            # Ensure users table has new auth & AI preference columns
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR;"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_ai_provider VARCHAR DEFAULT 'ollama';"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_ai_model VARCHAR DEFAULT 'qwen2.5-coder:7b';"))
            except Exception as col_err:
                log.warning("Notice on schema column checks: %s", col_err)
            
            log.info("Database connectivity and schema verified.")
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

