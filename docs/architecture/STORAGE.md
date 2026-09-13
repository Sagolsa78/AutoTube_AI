# AutoTube AI — Storage Architecture

## 1. Storage Interface (`backend/storage/base.py`)
All permanent media files must pass through the `StorageBackend` abstract interface:

```python
class StorageBackend(ABC):
    @abstractmethod
    async def put_file(self, local_path: str | Path, remote_key: str) -> str: ...
    
    @abstractmethod
    async def get_file(self, remote_key: str, local_path: str | Path) -> str: ...
    
    @abstractmethod
    async def delete_file(self, remote_key: str) -> bool: ...
    
    @abstractmethod
    async def exists(self, remote_key: str) -> bool: ...
    
    @abstractmethod
    async def get_public_url(self, remote_key: str) -> Optional[str]: ...
    
    @abstractmethod
    async def generate_signed_url(self, remote_key: str, expires_in: int = 3600) -> str: ...
```

---

## 2. Storage Implementations
1. **LocalStorageBackend (`backend/storage/local.py`)**:
   - Stores files in `settings.STORAGE_ROOT` (`./storage/`).
   - Resolves paths securely with directory traversal protection (`_get_abs_path`).
   - Serves files via FastAPI `/static/` or direct authenticated streaming.

2. **S3StorageBackend (`backend/storage/s3.py`)**:
   - Compatible with Cloudflare R2, AWS S3, and MinIO via `aioboto3`.
   - Generates signed URLs with configurable expiration (default 3600 seconds).
   - Enforces user-scoped key conventions.

---

## 3. Key Naming Convention
All permanent object keys must be strictly scoped to user IDs:
- **Videos**: `users/<user_id>/videos/<video_id>.mp4`
- **Thumbnails**: `users/<user_id>/thumbnails/<video_id>.jpg`
- **Logos / Watermarks**: `users/<user_id>/logos/<logo_id>.png`
- **Assets**: `users/<user_id>/assets/<asset_id>.mp4`

---

## 4. Temporary vs Permanent Storage
- Temporary working files (downloaded clips, raw audio, subtitles, filtergraph scripts) live in `/tmp/autotube/<job_id>/`.
- Once assembly is complete, the final video is uploaded to `StorageBackend.put_file`.
- A `try...finally` block in `RenderService` unconditionally removes `/tmp/autotube/<job_id>/` upon completion, failure, or cancellation.
