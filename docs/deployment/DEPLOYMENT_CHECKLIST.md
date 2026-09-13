# Pre-Flight Deployment Checklist

- [x] Python dependencies verified without contradictory constraints.
- [x] Database migrations up to date (`alembic upgrade head`).
- [x] Local standalone worker decoupled from FastAPI lifespan.
- [x] API creates and commits durable Job record prior to dispatch.
- [x] StorageBackend interface unified across local and S3/R2.
- [x] Tenant isolation verified across API endpoints (`test_tenant_isolation.py`).
- [x] YouTube OAuth tokens encrypted at rest via Fernet `ENCRYPTION_KEY`.
- [x] Video preview endpoint checks ownership and streams securely.
- [x] GitHub Actions workflow configured for one-shot worker execution.
- [x] Render web service configured with health checks and environment secrets.
- [x] Frontend build validated (`npm run build`).
- [x] Full automated test suite passes (`pytest -v`).
