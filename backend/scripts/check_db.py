import asyncio
import sys
import os

# Add parent dir to path so we can import src
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from src.infrastructure.database import get_engine
from src.config import settings

async def check():
    print(f"Checking connection to: {settings.database_url}")
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Success! Connected to: {version}")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        print("\nTip: Make sure the postgres container is running: 'docker compose up -d postgres'")

if __name__ == "__main__":
    asyncio.run(check())
