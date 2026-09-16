import os
import re


def replace_in_file(filepath, pattern, replacement):
    with open(filepath, "r") as f:
        content = f.read()

    new_content = re.sub(pattern, replacement, content)

    with open(filepath, "w") as f:
        f.write(new_content)


def main():
    # JobStatus.completed -> JobStatus.SUCCEEDED
    # JobStatus.failed -> JobStatus.FAILED
    for filepath in [
        "tests/test_worker.py",
        "tests/test_cloud_architecture.py",
        "tests/test_api_idempotency.py",
        "tests/test_pipeline.py",
    ]:
        if os.path.exists(filepath):
            replace_in_file(filepath, r"JobStatus\.completed", r"JobStatus.SUCCEEDED")
            replace_in_file(filepath, r"JobStatus\.failed", r"JobStatus.FAILED")
            replace_in_file(filepath, r"JobStatus\.running", r"JobStatus.RUNNING")
            replace_in_file(filepath, r"JobStatus\.created", r"JobStatus.CREATED")
            replace_in_file(filepath, r"JobStatus\.queued", r"JobStatus.QUEUED")


if __name__ == "__main__":
    main()
