import uuid
from datetime import datetime, timezone

import pytest

from backend.models.models import Job, JobStatus, PipelineStage


@pytest.fixture
def base_job():
    return Job(
        id=str(uuid.uuid4()),
        user_id="test_user",
        capability="RENDER",
        status=JobStatus.CREATED,
    )


def test_initial_state(base_job):
    assert base_job.status == JobStatus.CREATED
    assert base_job.current_stage is None


def test_valid_transitions(base_job):
    # Created -> Queued
    base_job.transition_to(JobStatus.QUEUED)
    assert base_job.status == JobStatus.QUEUED

    # Queued -> Claimed
    base_job.transition_to(JobStatus.CLAIMED)
    assert base_job.status == JobStatus.CLAIMED

    # Claimed -> Running
    base_job.transition_to(JobStatus.RUNNING)
    assert base_job.status == JobStatus.RUNNING

    # Running -> Paused -> Running
    base_job.transition_to(JobStatus.PAUSED)
    assert base_job.status == JobStatus.PAUSED
    base_job.transition_to(JobStatus.RUNNING)
    assert base_job.status == JobStatus.RUNNING

    # Running -> Succeeded
    base_job.transition_to(JobStatus.SUCCEEDED)
    assert base_job.status == JobStatus.SUCCEEDED


def test_invalid_transition(base_job):
    # Created -> Running is invalid
    with pytest.raises(ValueError):
        base_job.transition_to(JobStatus.RUNNING)
    assert base_job.status == JobStatus.CREATED


def test_terminal_states(base_job):
    base_job.transition_to(JobStatus.CANCELLED)

    # Cannot transition out of cancelled
    with pytest.raises(ValueError):
        base_job.transition_to(JobStatus.QUEUED)

    with pytest.raises(ValueError):
        base_job.transition_to(JobStatus.RUNNING)


def test_retry_flow(base_job):
    base_job.transition_to(JobStatus.QUEUED)
    base_job.transition_to(JobStatus.CLAIMED)
    base_job.transition_to(JobStatus.RUNNING)

    base_job.transition_to(JobStatus.FAILED)
    assert base_job.status == JobStatus.FAILED

    base_job.transition_to(JobStatus.RETRYING)
    assert base_job.status == JobStatus.RETRYING

    base_job.transition_to(JobStatus.QUEUED)
    assert base_job.status == JobStatus.QUEUED


def test_dead_letter_flow(base_job):
    base_job.transition_to(JobStatus.QUEUED)
    base_job.transition_to(JobStatus.CLAIMED)
    base_job.transition_to(JobStatus.FAILED)

    base_job.transition_to(JobStatus.DEAD_LETTER)
    assert base_job.status == JobStatus.DEAD_LETTER

    base_job.transition_to(JobStatus.QUEUED)
    assert base_job.status == JobStatus.QUEUED


def test_lease_and_heartbeat(base_job):
    now = datetime.now(timezone.utc)
    base_job.heartbeat_at = now
    base_job.lease_expires_at = now

    assert base_job.heartbeat_at == now
    assert base_job.lease_expires_at == now


def test_pipeline_stage():
    job = Job(
        id=str(uuid.uuid4()),
        user_id="test_user",
        capability="RENDER",
        status=JobStatus.CREATED,
        current_stage=PipelineStage.RENDER,
    )
    assert job.current_stage == PipelineStage.RENDER
