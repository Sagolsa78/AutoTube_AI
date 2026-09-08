import os
import json
import logging
from typing import Any, Dict

log = logging.getLogger(__name__)

class EventBus:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis = None

    async def _get_redis(self):
        if not self.redis:
            try:
                import redis.asyncio as redis_async
                self.redis = redis_async.from_url(self.redis_url)
            except ImportError:
                log.warning("redis package not installed. Events will not be published.")
        return self.redis

    async def publish(self, event_type: str, payload: Dict[str, Any]):
        """
        Publish an event to the Redis bus for n8n/Temporal or workers to consume.
        """
        try:
            r = await self._get_redis()
            if r:
                message = json.dumps({"event": event_type, "data": payload})
                await r.publish("autotube_events", message)
                log.info(f"Published event: {event_type}")
            else:
                log.info(f"Mock published event: {event_type} - {payload}")
        except Exception as e:
            log.error(f"Failed to publish event {event_type}: {e}")

# Singleton instance
event_bus = EventBus()
