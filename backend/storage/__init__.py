from backend.core.config import settings
from backend.storage.base import StorageBackend

def get_storage() -> StorageBackend:
    """Factory function to get the configured storage backend."""
    if settings.STORAGE_BACKEND in ["s3", "r2"]:
        from backend.storage.s3 import S3StorageBackend
        return S3StorageBackend()
    else:
        from backend.storage.local import LocalStorageBackend
        return LocalStorageBackend(base_dir=settings.STORAGE_ROOT)

# Global singleton
storage = get_storage()
