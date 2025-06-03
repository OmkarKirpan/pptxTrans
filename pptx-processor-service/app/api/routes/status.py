from fastapi import APIRouter, HTTPException, Path, Depends
from uuid import UUID
import logging

from app.models.schemas import ProcessingStatusResponse, ProcessedPresentation
from app.services.job_status import get_job_status
from app.services.results_service import get_processing_results
from app.services.pptx_processor import queue_pptx_processing, get_job_file_path
from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status/{job_id}", response_model=ProcessingStatusResponse)
async def get_processing_status(
    job_id: str = Path(..., description="ID of the processing job"),
    settings: Settings = Depends(get_settings)
):
    """
    Get the status of a processing job.

    - **job_id**: The ID of the processing job to check
    """
    try:
        status = await get_job_status(job_id)
        if status is None:
            raise HTTPException(
                status_code=404, detail=f"Job {job_id} not found")
        return status
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{session_id}", response_model=ProcessedPresentation)
async def get_results(
    session_id: str = Path(..., description="ID of the translation session"),
    settings: Settings = Depends(get_settings)
):
    """
    Get the results of a completed processing job.

    - **session_id**: The ID of the translation session
    """
    try:
        results = await get_processing_results(session_id)
        return results
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Results not found for session: {session_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving processing results: {str(e)}"
        )


@router.post("/retry/{job_id}", response_model=ProcessingStatusResponse)
async def retry_failed_job(job_id: str, settings: Settings = Depends(get_settings)):
    """
    Retry a failed job.
    """
    try:
        # Get current job status
        status = await get_job_status(job_id)
        if status is None:
            raise HTTPException(
                status_code=404, detail=f"Job {job_id} not found")

        # Only allow retrying failed jobs
        if status.status != "failed":
            raise HTTPException(
                status_code=400,
                detail=f"Can only retry failed jobs. Current status: {status.status}"
            )

        # Get the file path for the job
        file_path = await get_job_file_path(job_id)
        if not file_path:
            raise HTTPException(
                status_code=404,
                detail=f"Original file for job {job_id} not found or already cleaned up"
            )

        # Requeue the job for processing
        await queue_pptx_processing(
            job_id=job_id,
            session_id=status.session_id,
            file_path=file_path,
            generate_thumbnails=True
        )

        # Return the updated status
        new_status = await get_job_status(job_id)
        return new_status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
