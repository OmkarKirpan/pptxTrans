from fastapi import APIRouter, Form, HTTPException, BackgroundTasks, Depends, Path
from fastapi.responses import JSONResponse
from typing import Optional
import uuid
import os
import tempfile
from datetime import datetime, timedelta

from app.core.config import Settings, get_settings
from app.models.schemas import ExportResponse, DownloadUrlResponse, ProcessingStatus, ProcessingStatusResponse
from app.services.supabase_service import validate_supabase_credentials, get_supabase_signed_url
from app.services.job_status_service import create_job_status, update_job_status, get_job_status
from app.services.pptx_export import export_pptx_task

router = APIRouter()


@router.post("/export", status_code=202, response_model=ExportResponse)
async def export_pptx(
    session_id: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    settings: Settings = Depends(get_settings)
):
    """
    Export a processed presentation as a PPTX file.
    
    - **session_id**: Unique identifier for the translation session to export
    """
    try:
        # Validate Supabase credentials
        try:
            await validate_supabase_credentials(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid Supabase credentials: {str(e)}"
            )

        # Generate a unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job status
        await create_job_status(
            job_id=job_id,
            session_id=session_id,
            status=ProcessingStatus.QUEUED,
            current_stage="Export queued"
        )
        
        # Add export task to background queue
        background_tasks.add_task(
            export_pptx_task,
            job_id=job_id,
            session_id=session_id
        )
        
        return ExportResponse(
            job_id=job_id,
            session_id=session_id,
            status=ProcessingStatus.QUEUED,
            message="PPTX export has been queued"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue export: {str(e)}"
        )


@router.get("/export/{session_id}/download", response_model=DownloadUrlResponse)
async def get_export_download_url(
    session_id: str = Path(..., description="Session ID of the exported presentation"),
    settings: Settings = Depends(get_settings)
):
    """
    Get a download URL for an exported PPTX file.
    
    - **session_id**: Unique identifier for the translation session
    """
    try:
        # Generate a signed URL for the exported file
        destination_path = f"{session_id}/translated.pptx"
        expiration = datetime.now() + timedelta(hours=1)  # URL expires in 1 hour
        
        download_url = await get_supabase_signed_url(
            bucket="exported-files",
            path=destination_path,
            expiration=expiration
        )
        
        if not download_url:
            raise HTTPException(
                status_code=404,
                detail="Exported file not found"
            )
        
        return DownloadUrlResponse(
            download_url=download_url,
            expires_at=expiration
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate download URL: {str(e)}"
        )


async def export_pptx_task(job_id: str, session_id: str):
    """
    Background task to generate PPTX from translated slides.
    
    This placeholder implementation needs to be completed with the actual export logic.
    """
    try:
        # Update job status to processing
        await update_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.PROCESSING,
                progress=5,
                current_stage="Starting PPTX export"
            )
        )
        
        # TODO: Implement actual export logic
        # 1. Retrieve session data from Supabase
        # 2. Get original PPTX file or create new presentation
        # 3. Process each slide with translated text
        # 4. Save the presentation to a temporary file
        # 5. Upload to Supabase storage
        
        # For now, we'll simulate a successful export with a delay
        import asyncio
        await asyncio.sleep(5)  # Simulate processing time
        
        # Update job status to completed with a placeholder URL
        # In the real implementation, this would be the actual URL to the exported file
        placeholder_url = f"https://example.com/{session_id}/translated.pptx"
        
        await update_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.COMPLETED,
                progress=100,
                current_stage="Export completed",
                completed_at=datetime.now(),
                message=f"Export completed. File is available for download."
            )
        )
        
    except Exception as e:
        # Update job status to failed
        await update_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.FAILED,
                progress=0,
                current_stage="Export failed",
                error=str(e)
            )
        ) 