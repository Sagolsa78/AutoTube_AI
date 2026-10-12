import asyncio

from backend.db.database import engine
from backend.models.models import Base


async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


asyncio.run(init())
