from fastapi import APIRouter, HTTPException, Path, Depends
from app.models.schemas import ProcessingStatusResponse, ProcessedPresentation
from app.services.job_status import get_job_status
from app.services.results_service import get_processing_results
from app.core.config import Settings, get_settings

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
        return status
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving job status: {str(e)}"
        )


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
