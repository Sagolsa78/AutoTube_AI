"""
Script to apply CORS configuration to Cloudflare R2 bucket.
This allows the frontend to directly stream video content from R2 via pre-signed URLs
without encountering cross-origin restrictions when requesting byte ranges.
"""

import asyncio
import logging

from backend.core.config import settings
from backend.storage.s3 import S3StorageBackend

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Cloudflare R2 CORS Configuration
# AllowedOrigins should ideally be restricted to actual domains in production.
CORS_CONFIGURATION = {
    "CORSRules": [
        {
            "AllowedOrigins": [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                "https://yourdomain.com",  # Update to actual production domain
            ],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["Content-Range", "Content-Length", "ETag"],
            "MaxAgeSeconds": 3600,
        }
    ]
}


async def configure_cors():
    if settings.STORAGE_BACKEND not in ["s3", "r2"]:
        log.error("STORAGE_BACKEND is not 's3' or 'r2'. Aborting.")
        return

    storage = S3StorageBackend()

    log.info(f"Applying CORS configuration to bucket: {storage.bucket}")

    try:
        async with storage.session.client(
            "s3", endpoint_url=storage.endpoint_url, config=storage.s3_config
        ) as s3:
            await s3.put_bucket_cors(
                Bucket=storage.bucket, CORSConfiguration=CORS_CONFIGURATION
            )
        log.info("Successfully applied CORS configuration!")

        # Verify it
        async with storage.session.client(
            "s3", endpoint_url=storage.endpoint_url, config=storage.s3_config
        ) as s3:
            resp = await s3.get_bucket_cors(Bucket=storage.bucket)
            log.info(f"Current CORS: {resp.get('CORSRules')}")

    except Exception as e:
        log.error(f"Failed to apply CORS configuration: {e}")


if __name__ == "__main__":
    asyncio.run(configure_cors())
