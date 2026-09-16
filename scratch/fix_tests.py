import os
import re


def replace_in_file(filepath, pattern, replacement):
    with open(filepath, "r") as f:
        content = f.read()

    new_content = re.sub(pattern, replacement, content)

    with open(filepath, "w") as f:
        f.write(new_content)


def main():
    # 1. JobStatus.queued -> JobStatus.QUEUED
    for filepath in ["tests/test_worker.py", "tests/test_cloud_architecture.py"]:
        replace_in_file(filepath, r"JobStatus\.queued", r"JobStatus.QUEUED")

    # 2. MockDB in test_pipeline.py needs scalar()
    test_pipeline = "tests/test_pipeline.py"
    replace_in_file(
        test_pipeline,
        r"async def mock_get\(model, id\):\n\s*if model == Channel: return channel\n\s*return None\n\s*db\.get = mock_get",
        r"async def mock_get(model, id):\n            if model == Channel: return channel\n            return None\n        db.get = mock_get\n\n        async def mock_scalar(stmt):\n            return channel\n        db.scalar = mock_scalar",
    )

    # 3. test_api_idempotency.py JobCreateRequest validation error
    test_idem = "tests/test_api_idempotency.py"
    replace_in_file(
        test_idem,
        r'"payload": \{\"prompt\": \"Test Job\"\}',
        r'"payload": {"video_id": "vid1", "story_spec": {"topic": "T", "scenes": []}}',
    )

    # 4. test_storage.py test_s3_put_file_fallback ContentType missing from mock
    test_storage = "tests/test_storage.py"
    replace_in_file(
        test_storage,
        r"mock_client\.put_object\.assert_called_with\(Bucket='test-bucket', Key='users/1/videos/v1\.mp4', Body=b'dummy video content'\)",
        r"mock_client.put_object.assert_called_with(Bucket='test-bucket', Key='users/1/videos/v1.mp4', Body=b'dummy video content', ContentType='video/mp4')",
    )


if __name__ == "__main__":
    main()
