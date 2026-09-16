import logging
from typing import Optional

from backend.core.config import settings

log = logging.getLogger(__name__)


class RedisClient:
    def __init__(self):
        self._redis = None
        self.redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")

    async def get_client(self):
        if not self._redis:
            try:
                import redis.asyncio as redis_async

                self._redis = redis_async.from_url(
                    self.redis_url, decode_responses=True
                )
                # Test connection
                await self._redis.ping()
            except ImportError:
                log.warning(
                    "redis package not installed. Redis capabilities will be disabled."
                )
                return None
            except Exception as e:
                log.error(f"Failed to connect to Redis: {e}")
                self._redis = None
        return self._redis

    async def close(self):
        if self._redis:
            await self._redis.aclose()
            self._redis = None


redis_manager = RedisClient()


async def get_redis():
    """Helper to quickly get a Redis connection."""
    return await redis_manager.get_client()
