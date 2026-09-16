import os
from unittest.mock import patch

import pytest

from backend.storage import get_storage
from backend.storage.local import LocalStorageBackend
from backend.storage.s3 import S3StorageBackend


def test_get_storage_local():
    with patch("backend.core.config.settings.STORAGE_BACKEND", "local"), patch(
        "backend.core.config.settings.STORAGE_ROOT", "/tmp/autotube"
    ):
        storage = get_storage()
        assert isinstance(storage, LocalStorageBackend)


def test_get_storage_backend_r2():
    with patch("backend.core.config.settings.STORAGE_BACKEND", "r2"), patch(
        "backend.storage.s3.S3StorageBackend.__init__", return_value=None
    ):
        backend = get_storage()
        assert isinstance(backend, S3StorageBackend)


@pytest.mark.asyncio
async def test_s3_put_file_fallback(tmp_path):
    test_file = tmp_path / "video.mp4"
    test_file.write_bytes(b"dummy video content")

    storage = S3StorageBackend()
    storage.bucket = "test-bucket"
    storage.public_domain = "https://cdn.example.com"

    # Mock s3 client
    from unittest.mock import AsyncMock, MagicMock

    mock_s3 = AsyncMock()
    # Simulate upload_file raising ClientError (e.g. AccessDenied on CreateMultipartUpload)
    mock_s3.upload_file.side_effect = Exception("AccessDenied: CreateMultipartUpload")

    mock_client_cm = AsyncMock()
    mock_client_cm.__aenter__.return_value = mock_s3
    mock_client_cm.__aexit__.return_value = None

    with patch.object(storage.session, "client", return_value=mock_client_cm):
        url = await storage.put_file(test_file, "users/1/videos/v1.mp4")

    # Verify upload_file was attempted, then put_object was called as fallback
    mock_s3.upload_file.assert_called_once()
    mock_s3.put_object.assert_called_once_with(
        Bucket="test-bucket",
        Key="users/1/videos/v1.mp4",
        Body=b"dummy video content",
        ContentType="video/mp4",
    )
    assert url == "https://cdn.example.com/users/1/videos/v1.mp4"
