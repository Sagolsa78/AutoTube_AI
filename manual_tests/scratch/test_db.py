import asyncio
from sqlalchemy import select
from backend.db.database import AsyncSessionLocal
from backend.models.models import Video

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Video))
        videos = result.scalars().all()
        for v in videos:
            print(f"Video {v.id}: status={v.status}, path={v.path}, notes={v.notes}")

asyncio.run(main())
