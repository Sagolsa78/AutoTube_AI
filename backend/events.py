import json
import logging
import os
from typing import Any, Dict

from backend.core.redis_client import get_redis

log = logging.getLogger(__name__)


class EventBus:
    async def publish(self, event_type: str, payload: Dict[str, Any]):
        """
        Publish an event to the Redis bus for n8n/Temporal or workers to consume.
        """
        try:
            r = await get_redis()
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
