import os
import logging
from pathlib import Path
from typing import Optional
import aioboto3
from botocore.config import Config

from backend.storage.base import StorageBackend
from backend.core.config import settings

log = logging.getLogger(__name__)

class S3StorageBackend(StorageBackend):
    """
    S3/R2 compatible storage backend using aioboto3.
    """
    def __init__(self):
        self.bucket = settings.S3_BUCKET_NAME
        self.endpoint_url = settings.S3_ENDPOINT_URL
        self.public_domain = settings.R2_PUBLIC_DOMAIN
        
        # Configure session
        self.session = aioboto3.Session(
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            # Region is required by boto3, even if endpoint_url overrides it
            region_name="auto" 
        )
        self.s3_config = Config(signature_version='s3v4')

    async def put_file(self, local_path: str | Path, remote_key: str) -> str:
        local_path = Path(local_path)
        content_type = 'video/mp4' if str(local_path).endswith('.mp4') else 'application/octet-stream'
        try:
            async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
                await s3.upload_file(str(local_path), self.bucket, remote_key, ExtraArgs={'ContentType': content_type})
        except Exception as err:
            log.warning(
                f"s3.upload_file failed ({err}). Falling back to single-part s3.put_object for {remote_key}..."
            )
            with open(local_path, "rb") as f:
                file_bytes = f.read()
            async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
                await s3.put_object(Bucket=self.bucket, Key=remote_key, Body=file_bytes, ContentType=content_type)
        
        log.info(f"Uploaded {local_path} to s3://{self.bucket}/{remote_key}")
            
        public_url = await self.get_public_url(remote_key)
        return public_url if public_url else await self.generate_signed_url(remote_key)

    async def get_file(self, remote_key: str, local_path: str | Path) -> str:
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
            await s3.download_file(self.bucket, remote_key, str(local_path))
            log.info(f"Downloaded s3://{self.bucket}/{remote_key} to {local_path}")
        return str(local_path)

    # Alias for get_file
    download = get_file

    async def delete_file(self, remote_key: str) -> bool:
        try:
            async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
                await s3.delete_object(Bucket=self.bucket, Key=remote_key)
                return True
        except Exception as e:
            log.warning(f"Failed to delete {remote_key}: {e}")
            return False

    async def exists(self, remote_key: str) -> bool:
        try:
            async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
                await s3.head_object(Bucket=self.bucket, Key=remote_key)
                return True
        except Exception:
            # head_object throws ClientError if not found
            return False

    async def get_public_url(self, remote_key: str) -> Optional[str]:
        if self.public_domain:
            domain = self.public_domain.rstrip('/')
            key = remote_key.lstrip('/')
            return f"{domain}/{key}"
        return None

    async def generate_signed_url(self, remote_key: str, expires_in: int = 3600) -> str:
        async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
            url = await s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': remote_key},
                ExpiresIn=expires_in
            )
            return url

    async def generate_upload_url(self, remote_key: str, expires_in: int = 3600) -> str:
        async with self.session.client('s3', endpoint_url=self.endpoint_url, config=self.s3_config) as s3:
            url = await s3.generate_presigned_url(
                'put_object',
                Params={'Bucket': self.bucket, 'Key': remote_key},
                ExpiresIn=expires_in
            )
            return url

# Backward-compatibility alias
S3Storage = S3StorageBackend

