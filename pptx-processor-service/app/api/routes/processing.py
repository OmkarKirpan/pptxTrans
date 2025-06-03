from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
import uuid
import os
import shutil
from datetime import datetime, timedelta

from app.core.config import Settings, get_settings
from app.models.schemas import ProcessingResponse, BatchProcessingResponse, BatchProcessingJob, ProcessingStatus
from app.services.pptx_processor import queue_pptx_processing
from app.services.supabase_service import validate_supabase_credentials

router = APIRouter()


@router.post("/process", status_code=202, response_model=ProcessingResponse)
async def process_pptx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session_id: str = Form(...),
    source_language: Optional[str] = Form(None),
    target_language: Optional[str] = Form(None),
    generate_thumbnails: bool = Form(True),
    settings: Settings = Depends(get_settings)
):
    """
    Process a PPTX file, converting slides to SVGs and extracting text data.

    - **file**: The PPTX file to process
    - **session_id**: Unique identifier for the translation session
    - **source_language**: The source language of the presentation
    - **target_language**: The target language for translation
    - **generate_thumbnails**: Whether to generate slide thumbnails
    """
    # Validate file type
    if file.content_type not in settings.SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Only PPTX files are supported."
        )

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

    # Create a temporary file path
    temp_dir = os.path.join(settings.TEMP_UPLOAD_DIR, job_id)
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, file.filename)

    # Save the uploaded file to the temporary location
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Queue the processing task in the background
    background_tasks.add_task(
        queue_pptx_processing,
        job_id=job_id,
        session_id=session_id,
        file_path=temp_file_path,
        source_language=source_language,
        target_language=target_language,
        generate_thumbnails=generate_thumbnails
    )

    # Estimate completion time (very rough estimate)
    estimated_completion_time = datetime.now() + timedelta(minutes=5)

    return ProcessingResponse(
        job_id=job_id,
        session_id=session_id,
        status=ProcessingStatus.QUEUED,
        message="PPTX processing has been queued",
        estimated_completion_time=estimated_completion_time
    )


@router.post("/process/batch", status_code=202, response_model=BatchProcessingResponse)
async def process_batch_pptx(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    batch_id: str = Form(...),
    session_ids: List[str] = Form(...),
    settings: Settings = Depends(get_settings)
):
    """
    Process multiple PPTX files in a batch.

    - **files**: The PPTX files to process
    - **batch_id**: Unique identifier for the batch
    - **session_ids**: Unique identifiers for each translation session
    """
    if len(files) != len(session_ids):
        raise HTTPException(
            status_code=400,
            detail="Number of files must match number of session IDs"
        )

    # Validate Supabase credentials
    try:
        await validate_supabase_credentials(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Supabase credentials: {str(e)}"
        )

    jobs = []

    for idx, (file, session_id) in enumerate(zip(files, session_ids)):
        # Validate file type
        if file.content_type not in settings.SUPPORTED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type for file {idx+1}: {file.content_type}. Only PPTX files are supported."
            )

        # Generate a unique job ID
        job_id = str(uuid.uuid4())

        # Create a temporary file path
        temp_dir = os.path.join(settings.TEMP_UPLOAD_DIR, job_id)
        os.makedirs(temp_dir, exist_ok=True)
        temp_file_path = os.path.join(temp_dir, file.filename)

        # Save the uploaded file to the temporary location
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Queue the processing task in the background
        background_tasks.add_task(
            queue_pptx_processing,
            job_id=job_id,
            session_id=session_id,
            file_path=temp_file_path,
            generate_thumbnails=True
        )

        jobs.append(
            BatchProcessingJob(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.QUEUED
            )
        )

    return BatchProcessingResponse(
        batch_id=batch_id,
        jobs=jobs
    )
