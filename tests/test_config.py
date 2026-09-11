import os
from backend.core.config import Settings

def test_config_loads_defaults():
    # Unset env vars to test defaults
    os.environ.pop("APP_ENV", None)
    
    settings = Settings()
    
    # Check default values
    assert settings.APP_ENV == "development"
    assert settings.STORAGE_PROVIDER == "local"
    assert settings.DATABASE_URL == "sqlite+aiosqlite:///autotube.db"
    assert settings.AUTH_DISABLED is True
    assert settings.AUTOTUBE_API_KEY == "dev-secret-key"

def test_config_cloud_overrides():
    os.environ["APP_ENV"] = "production"
    os.environ["STORAGE_PROVIDER"] = "r2"
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@host/db"
    os.environ["S3_BUCKET_NAME"] = "test-bucket"
    os.environ["S3_ENDPOINT_URL"] = "https://test.r2.cloudflarestorage.com"
    os.environ["S3_ACCESS_KEY_ID"] = "test-access"
    os.environ["S3_SECRET_ACCESS_KEY"] = "test-secret"
    os.environ["AUTH_DISABLED"] = "false"
    
    settings = Settings()
    
    assert settings.APP_ENV == "production"
    assert settings.STORAGE_PROVIDER == "r2"
    assert settings.DATABASE_URL == "postgresql+asyncpg://user:pass@host/db"
    assert settings.AUTH_DISABLED is False
    assert settings.S3_BUCKET_NAME == "test-bucket"
    
    # Cleanup
    for k in ["APP_ENV", "STORAGE_PROVIDER", "DATABASE_URL", "S3_BUCKET_NAME", "S3_ENDPOINT_URL", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "AUTH_DISABLED"]:
        os.environ.pop(k, None)
