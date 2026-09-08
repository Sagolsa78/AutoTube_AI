"""
Cloud Storage Abstraction
Migrates file storage operations (/audio, /visuals, /output temp folders) 
from local disk to an object store (e.g., AWS S3 or Cloudflare R2).

Provides an abstract interface that falls back to local disk in dev,
but routes to S3/R2 in production.
"""
import os
import logging
from typing import Optional

log = logging.getLogger(__name__)

class CloudStorage:
    def __init__(self, provider: str = "local"):
        # provider can be 'local', 's3', 'r2'
        self.provider = provider
        self.bucket = os.getenv("S3_BUCKET_NAME", "autoshorts-assets")
        self.local_root = os.getenv("LOCAL_STORAGE_ROOT", "storage")
        
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL")
        self.aws_access_key_id = os.getenv("S3_ACCESS_KEY_ID")
        self.aws_secret_access_key = os.getenv("S3_SECRET_ACCESS_KEY")
        self.region_name = os.getenv("S3_REGION", "us-east-1")

    async def _get_client(self):
        import aioboto3
        session = aioboto3.Session()
        return session.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            region_name=self.region_name
        )

    async def upload_file(self, local_path: str, remote_path: str) -> str:
        """
        Uploads a local file to the cloud bucket.
        Returns the public URL of the uploaded asset.
        """
        if self.provider == "local":
            log.info(f"[CloudStorage Local] 'Uploaded' {local_path} -> {remote_path}")
            return f"/static/{remote_path}"
            
        elif self.provider in ["s3", "r2"]:
            log.info(f"[CloudStorage {self.provider.upper()}] Uploading {local_path} to s3://{self.bucket}/{remote_path}")
            try:
                async with await self._get_client() as s3:
                    await s3.upload_file(local_path, self.bucket, remote_path)
                
                if self.endpoint_url:
                    return f"{self.endpoint_url}/{self.bucket}/{remote_path}"
                return f"https://{self.bucket}.s3.amazonaws.com/{remote_path}"
            except Exception as e:
                log.error(f"Failed to upload to S3: {e}")
                raise

    async def download_file(self, remote_path: str, local_path: str) -> str:
        """
        Downloads a file from the cloud bucket to local storage for processing.
        """
        if self.provider == "local":
            return local_path
        
        log.info(f"[CloudStorage] Downloading {remote_path} to {local_path}")
        try:
            async with await self._get_client() as s3:
                await s3.download_file(self.bucket, remote_path, local_path)
            return local_path
        except Exception as e:
            log.error(f"Failed to download from S3: {e}")
            raise

    async def get_signed_url(self, remote_path: str, expires_in: int = 3600) -> str:
        """
        Generates a pre-signed URL for secure, temporary frontend access.
        """
        if self.provider == "local":
            return f"/static/{remote_path}"
            
        try:
            async with await self._get_client() as s3:
                url = await s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': remote_path},
                    ExpiresIn=expires_in
                )
            return url
        except Exception as e:
            log.error(f"Failed to generate presigned URL: {e}")
            raise

    def get_public_url(self, remote_path: str) -> str:
        """
        Returns the permanent public URL for a media asset (e.g., Cloudflare R2 custom domain or CDN).
        """
        public_domain = os.getenv("R2_PUBLIC_DOMAIN") or os.getenv("S3_PUBLIC_DOMAIN")
        if public_domain:
            domain = public_domain.rstrip('/')
            clean_path = remote_path.lstrip('/')
            return f"{domain}/{clean_path}"
        if self.provider == "local":
            return f"/static/{remote_path}"
        if self.endpoint_url:
            return f"{self.endpoint_url}/{self.bucket}/{remote_path}"
        return f"https://{self.bucket}.s3.amazonaws.com/{remote_path}"

# Singleton instance for the app
storage = CloudStorage(provider=os.getenv("STORAGE_PROVIDER", "local"))

