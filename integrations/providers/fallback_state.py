import time
from threading import Lock


class ProviderQuotaTracker:
    """Tracks provider failures to avoid hammering exhausted quotas."""

    _cooldowns: dict[str, float] = {}  # provider -> earliest_retry_timestamp
    _lock = Lock()

    @classmethod
    def mark_exhausted(cls, provider: str, cooldown_seconds: int = 300):
        with cls._lock:
            cls._cooldowns[provider] = time.time() + cooldown_seconds

    @classmethod
    def is_available(cls, provider: str) -> bool:
        with cls._lock:
            deadline = cls._cooldowns.get(provider, 0)
            return time.time() >= deadline

    @classmethod
    def get_status(cls) -> dict:
        now = time.time()
        with cls._lock:
            return {
                p: {"cooldown_remaining": max(0, int(t - now))}
                for p, t in cls._cooldowns.items()
            }
