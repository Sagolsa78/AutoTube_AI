from typing import Protocol, Any, Dict
from backend.models.models import JobStatus

class JobExecutionHandle:
    def __init__(self, job_id: str):
        self.job_id = job_id

class JobExecutor(Protocol):
    """
    Protocol for dispatching compute jobs.
    Allows for both local execution and cloud execution (e.g., GitHub Actions).
    """

    async def submit(self, job_id: str, payload: Dict[str, Any]) -> JobExecutionHandle:
        """
        Submits a job for execution. 
        Updates the job status in the database to 'dispatched' or 'running' depending on the executor.
        """
        ...

    async def cancel(self, job_id: str) -> None:
        """
        Attempts to cancel a running job.
        """
        ...

    async def status(self, job_id: str) -> JobStatus:
        """
        Checks the remote status of a job (if applicable).
        """
        ...
