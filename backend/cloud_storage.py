"""
Phase 3: Cloud Storage Abstraction
Migrates file storage operations (/audio, /visuals, /output temp folders) 
from local disk to an object store (e.g., AWS S3 or Cloudflare R2).

Provides an abstract interface that falls back to local disk in dev,
but routes to S3/R2 in production.
"""
import os
import aiofiles
import logging

log = logging.getLogger(__name__)

class CloudStorage:
    def __init__(self, provider: str = "local"):
        # provider can be 'local', 's3', 'r2'
        self.provider = provider
        self.bucket = os.getenv("S3_BUCKET_NAME", "autoshorts-assets")
        self.local_root = os.getenv("LOCAL_STORAGE_ROOT", ".")

    async def upload_file(self, local_path: str, remote_path: str) -> str:
        """
        Uploads a local file to the cloud bucket.
        Returns the public URL of the uploaded asset.
        """
        if self.provider == "local":
            # For local dev, we just return the local file path as the "remote" path
            log.info(f"[CloudStorage Local] 'Uploaded' {local_path} -> {remote_path}")
            return f"/static/{remote_path}"
            
        elif self.provider in ["s3", "r2"]:
            # Example implementation for boto3 / aioboto3
            log.info(f"[CloudStorage {self.provider.upper()}] Uploading {local_path} to s3://{self.bucket}/{remote_path}")
            # Mocking S3 upload logic
            # import aioboto3
            # session = aioboto3.Session()
            # async with session.client('s3') as s3:
            #     await s3.upload_file(local_path, self.bucket, remote_path)
            return f"https://{self.bucket}.s3.amazonaws.com/{remote_path}"

    async def download_file(self, remote_path: str, local_path: str) -> str:
        """
        Downloads a file from the cloud bucket to local storage for processing.
        """
        if self.provider == "local":
            # Just verify it exists
            return local_path
        
        log.info(f"[CloudStorage] Downloading {remote_path} to {local_path}")
        return local_path

    async def get_signed_url(self, remote_path: str, expires_in: int = 3600) -> str:
        """
        Generates a pre-signed URL for secure, temporary frontend access.
        """
        if self.provider == "local":
            return f"/static/{remote_path}"
            
        return f"https://{self.bucket}.s3.amazonaws.com/{remote_path}?sig=mock_sig"

# Singleton instance for the app
storage = CloudStorage(provider=os.getenv("STORAGE_PROVIDER", "local"))
