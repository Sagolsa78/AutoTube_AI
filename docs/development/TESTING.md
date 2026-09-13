# Testing Strategy & Test Suite Guide

## Running the Automated Test Suite
To run all automated unit and integration tests:
```bash
pytest -v
```

## Test Directory Overview
- `tests/test_auth.py`: Verifies JWT issuance, header extraction, and API key authentication.
- `tests/test_tenant_isolation.py`: Cross-user isolation tests verifying User A cannot access User B's resources.
- `tests/test_pipeline.py`: Comprehensive tests for the rendering pipeline, AI metadata fallback, YouTube publishing failure states, and used script immutability.
- `tests/test_worker.py`: Worker execution, RenderJob reconstruction, single-shot execution, and error handling.
- `tests/test_cloud_architecture.py`: Job model, worker router telemetry, local-first routing, and budget caps.
- `tests/test_config.py`: Configuration defaults and cloud override validation.
- `tests/test_storage.py`: Local and S3/R2 storage adapters.
- `tests/test_visual_router.py`: Stock footage vs visual generation routing.
- `tests/test_matrix.py`: FFmpeg encoder fallbacks and voiceover idempotency.
- `tests/test_overhaul.py`: Multi-user registration, live AI provider detection, and zero-mock YouTube analytics.
- `tests/verify_all.py`: Standalone end-to-end multi-step verification runner.
