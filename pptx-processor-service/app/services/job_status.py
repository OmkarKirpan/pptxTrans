import os
import json
import logging
from typing import Dict, Any
import aiofiles
from datetime import datetime

from app.models.schemas import ProcessingStatusResponse

# In-memory job status store (for demo purposes)
# In a production environment, this would be stored in Redis or a similar service
JOB_STATUS: Dict[str, ProcessingStatusResponse] = {}

logger = logging.getLogger(__name__)


async def update_job_status(job_id: str, status: ProcessingStatusResponse) -> None:
    """
    Update the status of a processing job.

    In a production environment, this would be stored in Redis or a similar service.
    For this implementation, we'll use an in-memory dictionary and file-based backup.
    """
    # Update in-memory store
    JOB_STATUS[job_id] = status

    # Persist to disk as a backup
    try:
        os.makedirs("./job_status", exist_ok=True)
        status_file = f"./job_status/{job_id}.json"

        async with aiofiles.open(status_file, "w") as f:
            await f.write(status.json())

    except Exception as e:
        logger.error(f"Error persisting job status to disk: {str(e)}")


async def get_job_status(job_id: str) -> ProcessingStatusResponse:
    """
    Get the status of a processing job.

    Checks the in-memory store first, then falls back to the file-based backup.
    """
    # Check in-memory store
    if job_id in JOB_STATUS:
        return JOB_STATUS[job_id]

    # Fall back to file-based backup
    status_file = f"./job_status/{job_id}.json"

    if not os.path.exists(status_file):
        raise FileNotFoundError(f"Job status not found for job ID: {job_id}")

    try:
        async with aiofiles.open(status_file, "r") as f:
            status_json = await f.read()
            return ProcessingStatusResponse.parse_raw(status_json)

    except Exception as e:
        logger.error(f"Error reading job status from disk: {str(e)}")
        raise Exception(f"Failed to read job status: {str(e)}")


async def clear_job_status(job_id: str) -> None:
    """
    Clear the status of a processing job.

    This is used for cleanup after a job is completed or failed.
    """
    # Remove from in-memory store
    if job_id in JOB_STATUS:
        del JOB_STATUS[job_id]

    # Remove from disk
    status_file = f"./job_status/{job_id}.json"

    if os.path.exists(status_file):
        try:
            os.remove(status_file)
        except Exception as e:
            logger.error(f"Error removing job status file: {str(e)}")


async def get_all_active_jobs() -> Dict[str, ProcessingStatusResponse]:
    """
    Get all active processing jobs.

    This is useful for monitoring and management purposes.
    """
    # Return a copy of the in-memory store
    return dict(JOB_STATUS)
