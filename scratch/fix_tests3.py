import os
import re


def replace_in_file(filepath, pattern, replacement):
    with open(filepath, "r") as f:
        content = f.read()

    new_content = re.sub(pattern, replacement, content)

    with open(filepath, "w") as f:
        f.write(new_content)


def main():
    # 1. test_api_idempotency.py
    test_idem = "tests/test_api_idempotency.py"
    replace_in_file(
        test_idem,
        r'payload=\{"test": "data"\}',
        r'payload={"video_id": "vid1", "story_spec": {"topic": "T", "scenes": []}}',
    )

    # 2. test_cloud_architecture.py
    # Let's fix ALL payload={"test": "data"} inside JobCreateRequest or Job if needed
    test_cloud = "tests/test_cloud_architecture.py"
    replace_in_file(
        test_cloud,
        r'payload=\{"test": "data"\}',
        r'payload={"video_id": "vid1", "story_spec": {"topic": "T", "scenes": []}}',
    )
    replace_in_file(
        test_cloud,
        r'payload=\{"some": "payload"\}',
        r'payload={"video_id": "vid1", "story_spec": {"topic": "T", "scenes": []}}',
    )

    # 3. test_storage.py
    test_storage = "tests/test_storage.py"
    replace_in_file(
        test_storage,
        r"mock_s3\.put_object\.assert_called_once_with\(\n\s*Bucket=\"test-bucket\",\n\s*Key=\"users/1/videos/v1\.mp4\",\n\s*Body=b\"dummy video content\"\n\s*\)",
        r"mock_s3.put_object.assert_called_once_with(\n            Bucket=\"test-bucket\",\n            Key=\"users/1/videos/v1.mp4\",\n            Body=b\"dummy video content\",\n            ContentType=\"video/mp4\"\n        )",
    )


if __name__ == "__main__":
    main()
