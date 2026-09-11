from typing import Protocol, Optional
from pathlib import Path


class StorageBackend(Protocol):
    """
    Protocol defining the contract for all storage backends (Local, S3, R2).
    """

    async def put_file(self, local_path: str | Path, remote_key: str) -> str:
        """
        Uploads a local file to the storage backend.
        Returns the public or signed URL if available, else the remote key.
        """
        ...

    async def get_file(self, remote_key: str, local_path: str | Path) -> str:
        """
        Downloads a file from storage to the local path.
        Returns the local path.
        """
        ...

    async def delete_file(self, remote_key: str) -> bool:
        """
        Deletes a file from storage.
        Returns True if successful, False otherwise.
        """
        ...

    async def exists(self, remote_key: str) -> bool:
        """
        Checks if a file exists in storage.
        """
        ...

    async def get_public_url(self, remote_key: str) -> Optional[str]:
        """
        Returns a permanent public URL if the bucket/storage is public.
        """
        ...

    async def generate_signed_url(self, remote_key: str, expires_in: int = 3600) -> str:
        """
        Generates a temporary signed URL for downloading/viewing the file.
        """
        ...

    async def generate_upload_url(self, remote_key: str, expires_in: int = 3600) -> str:
        """
        Generates a temporary signed URL for direct client-side uploads.
        """
        ...
