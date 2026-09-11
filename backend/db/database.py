"""
Async database engine + session factory.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.models.models import Base
from backend.core.config import settings
import logging

log = logging.getLogger(__name__)

# Basic pool configuration; you can make this configurable via settings later
engine_kwargs = {
    "echo": False,
    "future": True,
}

# Add pool settings for PostgreSQL
if "postgresql" in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
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
    log.info("Checking database connectivity...")
    try:
        async with engine.begin() as conn:
            # Simple connection check
            await conn.run_sync(lambda sync_conn: None)
            log.info("Database connectivity established.")
    except Exception as e:
        log.error(f"Failed to connect to database: {e}")
        raise


async def get_db():
    """FastAPI dependency — yields an async session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
