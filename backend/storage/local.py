import os
import shutil
from pathlib import Path
from typing import Optional
from backend.storage.base import StorageBackend

class LocalStorageBackend(StorageBackend):
    """
    File system based storage backend for local development.
    """
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_abs_path(self, remote_key: str) -> Path:
        """Securely resolve the path and ensure it's within base_dir."""
        # Remove leading slashes to prevent absolute path injection
        clean_key = remote_key.lstrip("/")
        target_path = (self.base_dir / clean_key).resolve()
        
        # Prevent directory traversal
        if not str(target_path).startswith(str(self.base_dir)):
            raise ValueError(f"Invalid remote key (path traversal detected): {remote_key}")
            
        return target_path

    async def put_file(self, local_path: str | Path, remote_key: str) -> str:
        target = self._get_abs_path(remote_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(local_path, target)
        return str(target)

    async def get_file(self, remote_key: str, local_path: str | Path) -> str:
        source = self._get_abs_path(remote_key)
        if not source.exists():
            raise FileNotFoundError(f"File not found: {remote_key}")
        
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, local_path)
        return str(local_path)

    async def delete_file(self, remote_key: str) -> bool:
        target = self._get_abs_path(remote_key)
        if target.exists():
            target.unlink()
            return True
        return False

    async def exists(self, remote_key: str) -> bool:
        return self._get_abs_path(remote_key).exists()

    async def get_public_url(self, remote_key: str) -> Optional[str]:
        # For local dev, we might serve via a static route like /static/
        return f"/static/{remote_key}"

    async def generate_signed_url(self, remote_key: str, expires_in: int = 3600) -> str:
        # Local doesn't have true signed URLs, just return public URL
        return await self.get_public_url(remote_key) or ""

    async def generate_upload_url(self, remote_key: str, expires_in: int = 3600) -> str:
        # Local doesn't support direct upload URLs natively without an API endpoint
        raise NotImplementedError("Upload URLs not supported in LocalStorageBackend")
