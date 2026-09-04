import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
elif DATABASE_URL.startswith("sqlite"):
    DATABASE_URL = DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://")
    
async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE ideas SET status = 'promoted' WHERE status = 'scripted'"))
        await conn.execute(text("UPDATE ideas SET status = 'discarded' WHERE status IN ('rejected', 'approved')"))
        # Also clean up scripts if there were old status values not in our enum
        await conn.execute(text("UPDATE scripts SET status = 'discarded' WHERE status NOT IN ('draft', 'discarded', 'used_in_render') OR status IS NULL"))
        print("Data migrated successfully.")
        
if __name__ == "__main__":
    asyncio.run(main())
