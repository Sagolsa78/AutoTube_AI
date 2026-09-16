import pytest
from pydantic import ValidationError

from backend.api.routes.jobs import JobCreateRequest
from backend.worker_router import WorkerCapability


def test_job_create_request_validates_asset_payload():
    # Valid payload
    req = JobCreateRequest(
        capability=WorkerCapability.IMAGE,
        payload={"prompt": "A beautiful sunset", "mode": "IMAGE"},
    )
    assert req.payload["prompt"] == "A beautiful sunset"
    assert req.payload["mode"] == "IMAGE"

    # Missing prompt
    with pytest.raises(ValidationError) as exc:
        JobCreateRequest(capability=WorkerCapability.IMAGE, payload={"mode": "IMAGE"})
    assert "prompt" in str(exc.value)

    # Invalid mode
    with pytest.raises(ValidationError) as exc:
        JobCreateRequest(
            capability=WorkerCapability.IMAGE,
            payload={"prompt": "A beautiful sunset", "mode": "INVALID"},
        )
    assert "mode" in str(exc.value)


def test_job_create_request_validates_render_payload():
    # Valid payload requires video_id and story_spec
    story_spec = {"topic": "Test Topic", "language": "en"}
    req = JobCreateRequest(
        capability=WorkerCapability.RENDER,
        payload={"video_id": "vid-123", "story_spec": story_spec},
    )
    assert req.payload["video_id"] == "vid-123"
    assert req.payload["story_spec"]["topic"] == "Test Topic"

    # Missing video_id
    with pytest.raises(ValidationError) as exc:
        JobCreateRequest(
            capability=WorkerCapability.RENDER, payload={"story_spec": story_spec}
        )
    assert "video_id" in str(exc.value)
