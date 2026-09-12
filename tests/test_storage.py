import pytest
from backend.storage import get_storage
from backend.storage.local import LocalStorageBackend
from backend.storage.s3 import S3StorageBackend
import os
from unittest.mock import patch

def test_get_storage_local(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("STORAGE_ROOT", "/tmp/autotube")
    storage = get_storage()
    assert isinstance(storage, LocalStorageBackend)

def test_get_storage_backend_r2():
    os.environ["STORAGE_PROVIDER"] = "r2"
    with patch("backend.storage.s3.S3StorageBackend.__init__", return_value=None):
        backend = get_storage_backend()
        assert isinstance(backend, S3StorageBackend)
    
    # Cleanup
    os.environ.pop("STORAGE_PROVIDER", None)
