import os
import uuid
import logging
import time
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pptx import Presentation
from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont
import json
import shutil
from pptx.enum.text import PP_ALIGN, MSO_VERTICAL_ANCHOR
from pptx.util import Emu, Pt
import base64
from pptx.enum.shapes import MSO_SHAPE_TYPE
import subprocess
import tempfile
import glob
import xml.etree.ElementTree as ET
import re

from app.models.schemas import (
    ProcessedSlide,
    SlideShape,
    ProcessedPresentation,
    OverallProcessingStatus,
    ShapeType,
    CoordinateUnit,
    ProcessingStatusResponse,
    ProcessingStatus
)
from app.services.supabase_service import upload_file_to_supabase, update_job_status as update_supabase_job_status
from app.services.job_status import update_job_status as update_local_job_status, get_job_status
from app.core.config import get_settings
# Import the new ProcessingManager related functions
from app.services.processing_manager import get_processing_manager
from app.services.cache_service import get_cache_service # Import CacheService

logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()

# Removed hardcoded LIBREOFFICE_PATH, will use settings.LIBREOFFICE_PATH

# Dictionary to keep track of job file paths for retry capability
_job_file_paths = {}


async def get_job_file_path(job_id: str) -> Optional[str]:
    """
    Get the file path for a job.
    Returns None if the job doesn't exist or the file has been cleaned up.
    """
    # First check our in-memory cache
    if job_id in _job_file_paths and os.path.exists(_job_file_paths[job_id]):
        return _job_file_paths[job_id]

    # If not in memory, we can't retrieve it since we don't persistently store file paths
    return None


async def _generate_svgs_for_all_slides_libreoffice(
    presentation_path: str,
    output_dir: str,  # Directory where final slide_N.svg files will be stored
    slide_count: int
) -> Dict[int, str]:
    """
    Convert all slides from a presentation to SVG files using LibreOffice batch processing.
    Uses a single LibreOffice command to convert all slides at once for better performance.
    """
    if not settings.LIBREOFFICE_PATH or not os.path.exists(settings.LIBREOFFICE_PATH):
        logger.error(
            "LibreOffice path not configured or invalid. Cannot generate SVGs.")
        raise ValueError("LibreOffice not available for SVG generation")

    abs_presentation_path = os.path.abspath(presentation_path)
    if not os.path.exists(abs_presentation_path):
        logger.error(f"Presentation file not found: {abs_presentation_path}")
        raise FileNotFoundError(f"Presentation file not found: {abs_presentation_path}")

    # Create temporary directory for LibreOffice output
    temp_lo_output_dir = os.path.join(output_dir, f"lo_temp_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_lo_output_dir, exist_ok=True)
    abs_temp_output_dir = os.path.abspath(temp_lo_output_dir)

    try:
        logger.info(f"Converting {slide_count} slides from {abs_presentation_path} to SVG using LibreOffice")

        # Single LibreOffice command to convert all slides to SVG
        command = [
            settings.LIBREOFFICE_PATH,
            "--headless",
            "--convert-to", "svg:impress_svg_Export",
            "--outdir", abs_temp_output_dir,
            abs_presentation_path
        ]

        logger.info(f"Running LibreOffice command: {' '.join(command)}")
        
        process = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout for full presentation
        )
        
        logger.info(f"LibreOffice SVG conversion stdout: {process.stdout}")
        if process.stderr:
            logger.warning(f"LibreOffice SVG conversion stderr: {process.stderr}")

        # Find generated SVG files
        svg_files = glob.glob(os.path.join(abs_temp_output_dir, "*.svg"))
        logger.info(f"LibreOffice generated {len(svg_files)} SVG files: {svg_files}")

        if len(svg_files) == 0:
            logger.error("LibreOffice did not generate any SVG files")
            raise RuntimeError("LibreOffice SVG generation failed - no output files")

        # Map SVG files to slide numbers
        generated_svg_paths: Dict[int, str] = {}
        
        if len(svg_files) == 1 and slide_count > 1:
            # LibreOffice sometimes outputs a single multi-page SVG
            # For now, we'll treat this as an error and require individual slides
            logger.error("LibreOffice generated single SVG for multi-slide presentation")
            raise RuntimeError("LibreOffice generated single SVG instead of individual slides")
        
        elif len(svg_files) == slide_count:
            # Perfect match - sort files and map to slides
            svg_files.sort()  # Ensure consistent ordering
            for i, svg_file in enumerate(svg_files):
                slide_number = i + 1
                final_svg_name = f"slide_{slide_number}.svg"
                final_svg_path = os.path.join(output_dir, final_svg_name)
                shutil.move(svg_file, final_svg_path)
                generated_svg_paths[slide_number] = final_svg_path
                logger.info(f"Mapped slide {slide_number} to {final_svg_path}")
        
        else:
            # Mismatch between expected and actual SVG count
            logger.error(f"Expected {slide_count} SVG files, got {len(svg_files)}")
            raise RuntimeError(f"SVG count mismatch: expected {slide_count}, got {len(svg_files)}")

        # Clean up temporary directory
        shutil.rmtree(temp_lo_output_dir, ignore_errors=True)
        
        logger.info(f"Successfully generated SVGs for {len(generated_svg_paths)} slides")
        return generated_svg_paths

    except subprocess.CalledProcessError as e:
        logger.error(f"LibreOffice command failed: {e}")
        logger.error(f"Command output: {e.stdout}")
        logger.error(f"Command error: {e.stderr}")
        raise RuntimeError(f"LibreOffice SVG generation failed: {e}")
        
    except subprocess.TimeoutExpired:
        logger.error("LibreOffice SVG conversion timed out")
        raise RuntimeError("LibreOffice SVG generation timed out")
        
    except Exception as e:
        logger.error(f"Unexpected error during LibreOffice SVG generation: {str(e)}", exc_info=True)
        raise
        
    finally:
        # Ensure cleanup of temporary directory
        if os.path.exists(temp_lo_output_dir):
            shutil.rmtree(temp_lo_output_dir, ignore_errors=True)


async def queue_pptx_processing(
    job_id: str,
    session_id: str,
    file_path: str,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    generate_thumbnails: bool = True
) -> None:
    """
    Queue the PPTX processing task using the ProcessingManager.
    """
    _job_file_paths[job_id] = file_path

    # Initial status update to QUEUED, as the manager will pick it up.
    # The manager loop, when it picks a job, can update it to PROCESSING.
    # Or, process_pptx itself can update it to PROCESSING as its first step.
    # For now, let's set it to QUEUED reflecting it's in our system's queue.
    await update_local_job_status(
        job_id=job_id,
        status=ProcessingStatusResponse(
            job_id=job_id,
            session_id=session_id,
            status=ProcessingStatus.QUEUED, # Changed from PROCESSING to QUEUED
            progress=0,
            current_stage="Job queued for processing"
        )
    )

    job_details = {
        'job_id': job_id,
        'session_id': session_id,
        'file_path': file_path,
        'source_language': source_language,
        'target_language': target_language,
        'generate_thumbnails': generate_thumbnails
    }

    try:
        manager = get_processing_manager()
        await manager.submit_job(job_details)
        logger.info(f"Job {job_id} successfully submitted to ProcessingManager.")
    except Exception as e:
        logger.error(f"Failed to submit job {job_id} to ProcessingManager: {e}", exc_info=True)
        # Update status to FAILED if submission itself fails
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.FAILED,
                progress=0,
                current_stage="Failed to queue job",
                error=f"Failed to submit to manager: {str(e)}"
            )
        )
        # Also update Supabase status if needed
        await update_supabase_job_status(
            session_id=session_id, status="failed", error=f"Failed to queue job: {str(e)}"
        )
        # Re-raise or handle as appropriate for the caller
        raise


async def process_pptx(
    job_id: str,
    session_id: str,
    file_path: str,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    generate_thumbnails: bool = True
) -> None:
    """
    Process a PPTX file using LibreOffice-only approach.
    Checks cache first, then processes if not found, and stores to cache on success.
    """
    start_time = time.time()
    cache_service = get_cache_service()
    cache_params = {
        "source_language": source_language or "", # Ensure consistent type for key
        "target_language": target_language or "",
        "generate_thumbnails": generate_thumbnails
    }
    cache_key = cache_service.generate_cache_key(file_path, cache_params)

    if cache_key:
        cached_result_tuple = cache_service.get_cached_result(cache_key)
        if cached_result_tuple:
            cached_presentation, cached_result_url = cached_result_tuple
            logger.info(f"Cache hit for job {job_id} (session {session_id}) with key {cache_key}.")
            
            # Update local status to COMPLETED
            await update_local_job_status(
                job_id=job_id,
                status=ProcessingStatusResponse(
                    job_id=job_id, session_id=session_id, status=ProcessingStatus.COMPLETED,
                    progress=100, current_stage="Processing completed (from cache)",
                    completed_at=datetime.now() # Or use a cached completion time if stored
                )
            )
            # Update Supabase status
            await update_supabase_job_status(
                session_id=session_id,
                status="completed",
                slide_count=cached_presentation.slide_count,
                result_url=cached_result_url # This is the URL to the main result.json
            )
            # Potentially update _job_file_paths if needed for retries, though cache hit means no retry of processing.
            # For now, we assume original file path might still be relevant for other operations.
            if job_id not in _job_file_paths:
                 _job_file_paths[job_id] = file_path

            # Clean up the uploaded file since processing is "done" via cache
            # Ensure this cleanup logic is consistent with the non-cached path's finally block
            uploaded_file_dir_for_cleanup = os.path.dirname(file_path)
            try:
                if os.path.exists(uploaded_file_dir_for_cleanup):
                    # Ensure no processing_output dir is accidentally deleted if it wasn't created
                    # For cache hit, processing_output_dir is not created by this run.
                    # We only want to clean up the original uploaded file and its parent if empty.
                    if os.path.isfile(file_path): # Check if it's a file before deleting its dir
                         os.remove(file_path)
                         logger.info(f"Cleaned up source file (cache hit): {file_path}")
                         # Attempt to remove the directory if it's empty
                         try:
                             os.rmdir(uploaded_file_dir_for_cleanup)
                             logger.info(f"Cleaned up empty source directory (cache hit): {uploaded_file_dir_for_cleanup}")
                         except OSError:
                             logger.debug(f"Source directory not empty, not removed (cache hit): {uploaded_file_dir_for_cleanup}")


                    if job_id in _job_file_paths: # Remove from cache after cleanup
                        del _job_file_paths[job_id]

            except Exception as e_cleanup:
                logger.error(f"Error cleaning up source file on cache hit {file_path}: {str(e_cleanup)}")
            return # End processing here due to cache hit

    logger.info(f"Cache miss for job {job_id} (session {session_id}). Proceeding with full processing.")
    # Update local status to PROCESSING (if not already updated by manager)
    await update_local_job_status(
        job_id=job_id,
        status=ProcessingStatusResponse(
            job_id=job_id, session_id=session_id, status=ProcessingStatus.PROCESSING,
            progress=1, current_stage="Starting full processing"
        )
    )

    # processing_dir is the main directory for this job's outputs (SVGs, JSON)
    uploaded_file_dir = os.path.dirname(file_path)
    processing_output_dir = os.path.join(uploaded_file_dir, "processing_output")
    os.makedirs(processing_output_dir, exist_ok=True)

    try:
        # Validate LibreOffice availability upfront
        if not settings.LIBREOFFICE_PATH or not os.path.exists(settings.LIBREOFFICE_PATH):
            raise ValueError("LibreOffice not configured or not found")

        # Test LibreOffice functionality
        try:
            test_command = [settings.LIBREOFFICE_PATH, "--help"]
            subprocess.run(test_command, check=True, capture_output=True, text=True, timeout=30)
            logger.info(f"LibreOffice is available at: {settings.LIBREOFFICE_PATH}")
        except Exception as e:
            raise RuntimeError(f"LibreOffice test failed: {str(e)}")

        presentation = Presentation(file_path)
        slide_count = len(presentation.slides)

        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id, session_id=session_id, status=ProcessingStatus.PROCESSING,
                progress=5, current_stage=f"Opened presentation with {slide_count} slides"
            )
        )

        # Generate all SVGs using LibreOffice - this is now required, not optional
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id, session_id=session_id, status=ProcessingStatus.PROCESSING,
                progress=10, current_stage="Converting slides to SVG with LibreOffice"
            )
        )

        libreoffice_svgs = await _generate_svgs_for_all_slides_libreoffice(
            file_path, processing_output_dir, slide_count
        )
        
        if not libreoffice_svgs or len(libreoffice_svgs) != slide_count:
            raise RuntimeError(f"LibreOffice SVG generation failed - expected {slide_count} SVGs, got {len(libreoffice_svgs)}")

        logger.info(f"Successfully generated {len(libreoffice_svgs)} SVGs using LibreOffice")

        # Process each slide with enhanced text extraction
        processed_slides_data = []
        for idx, slide in enumerate(presentation.slides):
            slide_number = idx + 1
            progress = 20 + int((idx / slide_count) * 75)
            await update_local_job_status(
                job_id=job_id,
                status=ProcessingStatusResponse(
                    job_id=job_id, session_id=session_id, status=ProcessingStatus.PROCESSING,
                    progress=progress, current_stage=f"Processing slide {slide_number} of {slide_count}"
                )
            )

            # Verify LibreOffice SVG exists for this slide
            svg_path = libreoffice_svgs.get(slide_number)
            if not svg_path or not os.path.exists(svg_path):
                raise RuntimeError(f"LibreOffice SVG missing for slide {slide_number}")

            processed_slide = await process_slide_simplified(
                slide=slide,
                slide_number=slide_number,
                svg_path=svg_path,
                session_id=session_id,
                generate_thumbnail=generate_thumbnails
            )
            processed_slides_data.append(processed_slide)

        # Finalize processing
        processing_time = int(time.time() - start_time)
        result = ProcessedPresentation(
            session_id=session_id, 
            slide_count=slide_count,
            processing_status=OverallProcessingStatus.COMPLETED,
            processing_time=processing_time, 
            slides=processed_slides_data
        )

        result_file = os.path.join(processing_output_dir, f"result_{session_id}.json")
        with open(result_file, "w") as f:
            json.dump(result.model_dump(mode='json'), f, indent=4)

        result_url = await upload_file_to_supabase(
            file_path=result_file,
            bucket="processing-results", 
            destination_path=f"{session_id}/result.json"
        )

        # Store successful result in cache
        if cache_key and result_url: # result_url must exist to be a valid cache entry
            cache_service.store_cached_result(cache_key, result, result_url)
            logger.info(f"Processing result for job {job_id} stored in cache with key {cache_key}.")

        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id, session_id=session_id, status=ProcessingStatus.COMPLETED,
                progress=100, current_stage="Processing completed", completed_at=datetime.now()
            )
        )
        
        await update_supabase_job_status(
            session_id=session_id, 
            status="completed",
            slide_count=slide_count, 
            result_url=result_url
        )

    except Exception as e:
        logger.error(f"Error processing PPTX for job {job_id}: {str(e)}", exc_info=True)
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id, session_id=session_id, status=ProcessingStatus.FAILED,
                progress=0, current_stage="Processing failed", error=str(e) # Ensure progress is reset on failure
            )
        )
        await update_supabase_job_status(
            session_id=session_id, status="failed", error=str(e)
        )
        # Do not re-raise here if called by ProcessingManager, as it handles logging.
        # If this function can be called directly, re-raising might be desired.
        # For now, assuming ProcessingManager's _execute_job handles the top-level try/except.
        # However, if this function is intended to be a standalone callable that signals failure by raising,
        # then `raise` should be here. Given it's called by the manager, which logs, let's not re-raise.
        # Update: The manager calls this and logs, but the original function re-raised.
        # For consistency with how it was called by asyncio.create_task before, let's re-raise.
        raise
        
    finally:
        # Clean up temporary files from processing_output_dir and the uploaded file
        try:
            # This status check is to avoid deleting files if the job is still queued or actively processing
            # (e.g. if cleanup is called prematurely or from another context).
            # However, in the context of process_pptx, it has either completed or failed.
            current_job_status_info = await get_job_status(job_id)
            
            # Check if the job is truly finished (completed or failed) before cleaning up.
            # This helps prevent premature deletion if the job is retried or requeued by a more advanced manager.
            is_job_finished = current_job_status_info and current_job_status_info.status in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]

            if is_job_finished:
                if os.path.exists(processing_output_dir): # This is the specific output dir for this run
                    shutil.rmtree(processing_output_dir)
                    logger.info(f"Cleaned up temporary processing output directory: {processing_output_dir}")
                
                # Clean up the original uploaded file and its parent directory if empty
                if os.path.exists(uploaded_file_dir) and os.path.isdir(uploaded_file_dir):
                    # Original file path
                    original_upload_path = os.path.join(uploaded_file_dir, os.path.basename(file_path))
                    if os.path.exists(original_upload_path) and os.path.isfile(original_upload_path):
                        os.remove(original_upload_path)
                        logger.info(f"Cleaned up original uploaded file: {original_upload_path}")
                    
                    # Attempt to remove the parent directory if it's empty
                    # This assumes uploaded_file_dir is specific to this job's upload
                    # and doesn't contain other ongoing uploads.
                    try:
                        if not os.listdir(uploaded_file_dir): # Check if empty
                            os.rmdir(uploaded_file_dir)
                            logger.info(f"Cleaned up empty upload directory: {uploaded_file_dir}")
                    except OSError:
                        logger.debug(f"Upload directory not empty or other error, not removed: {uploaded_file_dir}")

                # Remove from job file paths cache
                if job_id in _job_file_paths:
                    del _job_file_paths[job_id]
            else:
                logger.info(f"Job {job_id} is not marked as finished ({current_job_status_info.status if current_job_status_info else 'unknown'}). Skipping cleanup of {processing_output_dir} and {uploaded_file_dir}.")

        except Exception as e_cleanup:
            logger.error(f"Error cleaning up temporary files for job {job_id} at {uploaded_file_dir}: {str(e_cleanup)}")


async def process_slide_simplified(
    slide,  # python-pptx Slide object
    slide_number: int,
    svg_path: str,  # Path to LibreOffice-generated SVG
    session_id: str,
    generate_thumbnail: bool = True
) -> ProcessedSlide:
    """
    Process a single slide using simplified LibreOffice-only approach.
    Enhanced text extraction optimized for translation workflows with coordinate validation.
    """
    slide_id = str(uuid.uuid4())

    # Get slide dimensions
    presentation = slide.part.package.presentation_part.presentation
    slide_width_emu = presentation.slide_width
    slide_height_emu = presentation.slide_height

    # Enhanced text extraction optimized for translation
    extracted_shapes_data = extract_shapes_enhanced(slide, slide_width_emu, slide_height_emu)

    # Validate and cross-reference coordinates with LibreOffice SVG
    validated_shapes_data = await validate_coordinates_with_svg(
        extracted_shapes_data, svg_path, slide_width_emu, slide_height_emu
    )

    # Add text segmentation for translation-ready units
    for shape in validated_shapes_data:
        if shape.shape_type == ShapeType.TEXT and shape.original_text:
            # Segment text for better translation workflow
            text_segments = segment_text_for_translation(shape.original_text, max_segment_length=150)
            
            # Add segmentation metadata to shape
            shape_dict = shape.dict()
            shape_dict.update({
                'text_segments': text_segments,
                'segment_count': len(text_segments),
                'is_segmented': len(text_segments) > 1
            })
            
            # Update the shape with new metadata
            validated_shapes_data[validated_shapes_data.index(shape)] = SlideShape(**shape_dict)

    # Upload LibreOffice SVG to Supabase
    svg_url = await upload_file_to_supabase(
        file_path=svg_path,
        bucket="slide-visuals", 
        destination_path=f"{session_id}/slide_{slide_number}.svg"
    )

    # Generate thumbnail if requested
    thumbnail_url = None
    if generate_thumbnail:
        thumbnail_file = f"{svg_path}_thumbnail.png"
        create_thumbnail_from_slide_enhanced(
            slide, validated_shapes_data, thumbnail_file, slide_width_emu, slide_height_emu
        )
        
        if os.path.exists(thumbnail_file):
            thumbnail_url = await upload_file_to_supabase(
                file_path=thumbnail_file,
                bucket="slide-visuals", 
                destination_path=f"{session_id}/thumbnails/slide_{slide_number}.png"
            )

    return ProcessedSlide(
        slide_id=slide_id, 
        slide_number=slide_number, 
        svg_url=svg_url or "",
        original_width=slide_width_emu, 
        original_height=slide_height_emu,
        thumbnail_url=thumbnail_url, 
        shapes=extracted_shapes_data
    )


def get_slide_background_fill(slide) -> str:
    """
    Attempts to get the slide background fill color.
    Returns a hex color string (e.g., "#FFFFFF") or a default.
    Note: python-pptx has limitations in accessing complex background fills (gradients, pictures).
    This function will try to get solid fills.
    """
    try:
        fill = slide.background.fill
        if fill.type == 1:  # MSO_FILL.SOLID
            rgb = fill.fore_color.rgb
            return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
        # Handling for MSO_FILL.GRADIENT, MSO_FILL.PATTERN, MSO_FILL.PICTURE etc. is more complex
        # and often not fully exposed or easily convertible to a single SVG color.
    except Exception as e:
        logger.debug(f"Could not determine slide background color: {e}")
    return "#ffffff"  # Default to white


def extract_shapes_enhanced(slide, slide_width_emu: int, slide_height_emu: int) -> List[SlideShape]:
    """
    Enhanced text extraction optimized for translation workflows.
    Provides more accurate coordinates and translation-focused metadata.
    """
    shapes_data = []
    
    if slide_width_emu == 0 or slide_height_emu == 0:
        logger.warning("Slide dimensions are zero, cannot calculate shape coordinates.")
        return []

    for idx, shape in enumerate(slide.shapes):
        # More precise coordinate calculations
        shape_left_emu = shape.left if shape.left is not None else 0
        shape_top_emu = shape.top if shape.top is not None else 0
        shape_width_emu = shape.width if shape.width is not None else 0
        shape_height_emu = shape.height if shape.height is not None else 0

        # Convert to absolute pixel coordinates for better precision
        EMU_PER_INCH = 914400
        DPI = 96
        
        # Calculate absolute coordinates in pixels
        x_px = int((shape_left_emu / EMU_PER_INCH) * DPI)
        y_px = int((shape_top_emu / EMU_PER_INCH) * DPI)
        width_px = int((shape_width_emu / EMU_PER_INCH) * DPI)
        height_px = int((shape_height_emu / EMU_PER_INCH) * DPI)

        shape_obj_data = {
            "shape_id": str(uuid.uuid4()),
            "x_coordinate": x_px,  # Using absolute pixels for better precision
            "y_coordinate": y_px,
            "width": width_px,
            "height": height_px,
            "coordinates_unit": CoordinateUnit.PIXELS,  # Changed to pixels
            "reading_order": idx + 1,
            "original_text": None,
        }

        # Handle text frames with enhanced translation metadata
        if shape.has_text_frame:
            text_frame = shape.text_frame
            full_text = text_frame.text.strip() if text_frame.text else ""
            if not full_text:
                continue

            shape_obj_data["original_text"] = full_text

            # Enhanced font and style extraction
            font_size_pt = 12.0
            font_family = "Arial"
            font_weight = "normal"
            font_style = "normal"
            hex_color = "#000000"
            text_align_str = "LEFT"
            vertical_anchor_str = "TOP"
            line_spacing_val = 1.0

            # Determine if this is a title or subtitle based on placeholder type
            is_title = False
            is_subtitle = False
            placeholder_type = None
            
            try:
                if hasattr(shape, 'placeholder_format') and shape.placeholder_format:
                    placeholder_type = str(shape.placeholder_format.type)
                    # Common title placeholder types in PowerPoint
                    if 'TITLE' in placeholder_type.upper():
                        is_title = True
                    elif 'SUBTITLE' in placeholder_type.upper():
                        is_subtitle = True
            except:
                # Fallback: detect titles by position and font size
                slide_height_px = int((slide_height_emu / EMU_PER_INCH) * DPI)
                if y_px < slide_height_px * 0.3 and height_px > 40:  # Top 30% and large text
                    is_title = True

            # Enhanced text analysis for translation
            text_length = len(full_text)
            word_count = len(full_text.split())
            
            # Translation priority based on position and content type
            translation_priority = 5  # Default medium priority
            if is_title:
                translation_priority = 10  # Highest priority
            elif is_subtitle:
                translation_priority = 8
            elif word_count > 20:  # Long text blocks
                translation_priority = 7
            elif word_count < 5:  # Short text, might be labels
                translation_priority = 3

            # Extract detailed font information
            if text_frame.paragraphs:
                first_paragraph = text_frame.paragraphs[0]

                # Text alignment
                if first_paragraph.alignment:
                    alignment_map = {
                        PP_ALIGN.LEFT: "LEFT", PP_ALIGN.CENTER: "CENTER",
                        PP_ALIGN.RIGHT: "RIGHT", PP_ALIGN.JUSTIFY: "JUSTIFY",
                        PP_ALIGN.DISTRIBUTE: "DISTRIBUTE"
                    }
                    text_align_str = alignment_map.get(first_paragraph.alignment, "LEFT")

                # Font properties from first run
                if first_paragraph.runs:
                    first_run = first_paragraph.runs[0]
                    if first_run.font:
                        font = first_run.font
                        if font.size:
                            font_size_pt = font.size.pt
                        if font.name:
                            font_family = font.name
                        if font.bold:
                            font_weight = "bold"
                        if font.italic:
                            font_style = "italic"
                        if font.color and hasattr(font.color, 'rgb') and font.color.rgb:
                            try:
                                hex_color = f"#{font.color.rgb[0]:02x}{font.color.rgb[1]:02x}{font.color.rgb[2]:02x}"
                            except:
                                hex_color = "#000000"

            # Vertical anchor
            if text_frame.vertical_anchor:
                anchor_map = {
                    MSO_VERTICAL_ANCHOR.TOP: "TOP",
                    MSO_VERTICAL_ANCHOR.MIDDLE: "MIDDLE",
                    MSO_VERTICAL_ANCHOR.BOTTOM: "BOTTOM"
                }
                vertical_anchor_str = anchor_map.get(text_frame.vertical_anchor, "TOP")

            # Enhanced shape data for translation optimization
            shape_obj_data.update({
                "shape_type": ShapeType.TEXT,
                "font_size": font_size_pt,
                "font_family": font_family,
                "font_weight": font_weight,
                "font_style": font_style,
                "color": hex_color,
                "text_align": text_align_str,
                "vertical_anchor": vertical_anchor_str,
                "line_spacing": line_spacing_val,
                # Translation-specific metadata
                "is_title": is_title,
                "is_subtitle": is_subtitle,
                "text_length": text_length,
                "word_count": word_count,
                "translation_priority": translation_priority,
                "placeholder_type": placeholder_type,
                # Initialize coordinate validation fields
                "coordinate_validation_score": None,
                "svg_matched": None,
                "svg_original_x": None,
                "svg_original_y": None,
                "coordinate_source": "pptx_extraction"
            })
            
            shapes_data.append(SlideShape(**shape_obj_data))

        # Handle images (simplified for now, focus on text)
        elif shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            try:
                shape_obj_data.update({
                    "shape_type": ShapeType.IMAGE,
                    "is_title": False,
                    "is_subtitle": False,
                    "text_length": 0,
                    "word_count": 0,
                    "translation_priority": 1,  # Low priority for images
                    # Initialize coordinate validation fields for images
                    "coordinate_validation_score": None,
                    "svg_matched": None,
                    "svg_original_x": None,
                    "svg_original_y": None,
                    "coordinate_source": "pptx_extraction"
                })
                shapes_data.append(SlideShape(**shape_obj_data))
            except Exception as e:
                logger.warning(f"Could not process image shape {idx}: {e}")
                continue

    return shapes_data


def create_thumbnail_from_slide_enhanced(
    slide,  # python-pptx slide object
    shapes_data: List[SlideShape],  # Pre-extracted shapes data
    file_path: str,
    slide_width_emu: int,
    slide_height_emu: int,
    thumbnail_width_px: int = 250
) -> None:
    """
    Enhanced thumbnail generation optimized for translation preview.
    Creates a high-quality thumbnail that clearly shows text layout.
    """
    EMU_PER_INCH = 914400
    DPI = 96
    POINTS_PER_INCH = 72

    # Calculate original dimensions in pixels
    original_width_px = max(1, int((slide_width_emu / EMU_PER_INCH) * DPI))
    original_height_px = max(1, int((slide_height_emu / EMU_PER_INCH) * DPI))

    # Calculate thumbnail dimensions maintaining aspect ratio
    aspect_ratio = original_height_px / original_width_px
    thumbnail_height_px = int(thumbnail_width_px * aspect_ratio)

    # Create high-quality thumbnail
    thumbnail = Image.new('RGB', (thumbnail_width_px, thumbnail_height_px), 'white')
    draw = ImageDraw.Draw(thumbnail)

    # Scale factors for thumbnail
    scale_x = thumbnail_width_px / original_width_px
    scale_y = thumbnail_height_px / original_height_px

    # Draw slide background
    background_color = get_slide_background_fill(slide)
    if background_color and background_color != "#ffffff":
        try:
            thumbnail.paste(background_color, (0, 0, thumbnail_width_px, thumbnail_height_px))
        except:
            pass  # Use white background as fallback

    # Draw text shapes with better visibility for translation preview
    for shape_data in shapes_data:
        if shape_data.shape_type != ShapeType.TEXT or not shape_data.original_text:
            continue

        # Scale coordinates for thumbnail
        x = int(shape_data.x_coordinate * scale_x)
        y = int(shape_data.y_coordinate * scale_y)
        width = int(shape_data.width * scale_x)
        height = int(shape_data.height * scale_y)

        # Ensure minimum visible size
        width = max(width, 10)
        height = max(height, 8)

        # Draw text background for better visibility
        bg_color = (240, 240, 240, 128)  # Light gray with transparency
        if shape_data.is_title:
            bg_color = (255, 255, 200, 128)  # Light yellow for titles
        elif shape_data.is_subtitle:
            bg_color = (255, 240, 200, 128)  # Light orange for subtitles

        try:
            draw.rectangle([x, y, x + width, y + height], fill=bg_color[:3], outline=(200, 200, 200))
        except:
            pass

        # Draw text with appropriate size for thumbnail
        try:
            # Use a standard font for thumbnails
            font_size = max(8, min(16, int((shape_data.font_size or 12) * scale_y * 0.8)))
            
            # Simplified text rendering - just show that text exists
            text_preview = shape_data.original_text[:50] + "..." if len(shape_data.original_text) > 50 else shape_data.original_text
            
            # Text color with good contrast
            text_color = (0, 0, 0)  # Black for good visibility in thumbnails
            if shape_data.color and shape_data.color != "#000000":
                try:
                    # Convert hex to RGB
                    hex_color = shape_data.color.lstrip('#')
                    text_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                except:
                    text_color = (0, 0, 0)

            # Draw text (simplified approach for thumbnails)
            draw.text((x + 2, y + 2), text_preview, fill=text_color)
            
        except Exception as e:
            logger.debug(f"Could not draw text in thumbnail: {e}")
            # Draw a simple text indicator
            draw.rectangle([x + 2, y + 2, x + width - 2, y + 10], fill=(100, 100, 100))

    # Save thumbnail
    try:
        thumbnail.save(file_path, 'PNG', quality=95, optimize=True)
        logger.info(f"Enhanced thumbnail saved: {file_path}")
    except Exception as e:
        logger.error(f"Error saving enhanced thumbnail: {e}")
        # Create a simple fallback thumbnail
        fallback = Image.new('RGB', (thumbnail_width_px, thumbnail_height_px), 'white')
        fallback.save(file_path, 'PNG')


async def validate_coordinates_with_svg(
    shapes_data: List[SlideShape],
    svg_path: str,
    slide_width_emu: int,
    slide_height_emu: int
) -> List[SlideShape]:
    """
    Enhanced cross-reference validation of extracted coordinates against LibreOffice SVG output.
    Provides more accurate coordinate mapping and better text matching for translation workflows.
    """
    if not os.path.exists(svg_path):
        logger.warning(f"SVG file not found for coordinate validation: {svg_path}")
        # Mark all shapes as unvalidated but with source information
        return _mark_shapes_as_unvalidated(shapes_data, "svg_file_missing")

    try:
        # Parse the LibreOffice-generated SVG with namespace handling
        tree = ET.parse(svg_path)
        root = tree.getroot()
        
        # Handle SVG namespace prefixes
        namespaces = {'svg': 'http://www.w3.org/2000/svg'}
        if root.tag.startswith('{'):
            # Extract namespace from root tag
            namespace = root.tag.split('}')[0][1:]
            namespaces['svg'] = namespace

        # Enhanced SVG dimension parsing
        svg_info = _extract_svg_dimensions(root)
        
        # Calculate coordinate transformation factors
        EMU_PER_INCH = 914400
        DPI = 96
        
        # Original slide dimensions in pixels
        slide_width_px = int((slide_width_emu / EMU_PER_INCH) * DPI)
        slide_height_px = int((slide_height_emu / EMU_PER_INCH) * DPI)
        
        # Calculate more accurate scaling factors
        transform_info = _calculate_coordinate_transform(
            svg_info, slide_width_px, slide_height_px
        )
        
        logger.info(f"SVG validation transform: slide({slide_width_px}x{slide_height_px}) -> "
                   f"svg({svg_info['width']}x{svg_info['height']}), "
                   f"scale({transform_info['scale_x']:.4f}, {transform_info['scale_y']:.4f})")

        # Enhanced text element extraction from SVG
        svg_text_elements = _extract_svg_text_elements(root, namespaces)
        
        logger.info(f"Found {len(svg_text_elements)} text elements in SVG for validation")

        # Cross-reference and validate coordinates with enhanced matching
        validated_shapes = []
        validation_stats = {'exact_matches': 0, 'fuzzy_matches': 0, 'no_matches': 0}
        
        for shape in shapes_data:
            if shape.shape_type != ShapeType.TEXT or not shape.original_text:
                # Non-text shapes get minimal validation metadata
                shape_dict = shape.dict()
                shape_dict.update({
                    'coordinate_validation_score': None,
                    'svg_matched': False,
                    'coordinate_source': 'pptx_extraction'
                })
                validated_shapes.append(SlideShape(**shape_dict))
                continue

            # Enhanced text matching with multiple strategies
            match_result = _find_best_svg_text_match(shape.original_text, svg_text_elements)
            
            if match_result['score'] > 0.0:
                # Apply coordinate transformation and validation
                validated_shape = _apply_coordinate_validation(
                    shape, match_result, transform_info
                )
                validated_shapes.append(validated_shape)
                
                # Update statistics
                if match_result['score'] >= 0.95:
                    validation_stats['exact_matches'] += 1
                else:
                    validation_stats['fuzzy_matches'] += 1
                    
                logger.debug(f"Validated coordinates for text '{shape.original_text[:30]}...': "
                           f"({shape.x_coordinate}, {shape.y_coordinate}) -> "
                           f"({validated_shape.x_coordinate}, {validated_shape.y_coordinate}), "
                           f"score: {match_result['score']:.3f}")
            else:
                # No match found - keep original coordinates but mark as unvalidated
                shape_dict = shape.dict()
                shape_dict.update({
                    'coordinate_validation_score': 0.0,
                    'svg_matched': False,
                    'coordinate_source': 'pptx_extraction',
                    'svg_original_x': None,
                    'svg_original_y': None
                })
                validated_shapes.append(SlideShape(**shape_dict))
                validation_stats['no_matches'] += 1

        # Log validation summary
        total_text_shapes = validation_stats['exact_matches'] + validation_stats['fuzzy_matches'] + validation_stats['no_matches']
        if total_text_shapes > 0:
            match_rate = (validation_stats['exact_matches'] + validation_stats['fuzzy_matches']) / total_text_shapes * 100
            logger.info(f"SVG validation summary: {total_text_shapes} text shapes, "
                       f"{validation_stats['exact_matches']} exact, "
                       f"{validation_stats['fuzzy_matches']} fuzzy, "
                       f"{validation_stats['no_matches']} unmatched, "
                       f"{match_rate:.1f}% match rate")

        return validated_shapes

    except Exception as e:
        logger.warning(f"Error during coordinate validation: {str(e)}", exc_info=True)
        # Return original shapes with error metadata
        return _mark_shapes_as_unvalidated(shapes_data, f"validation_error: {str(e)}")


def _mark_shapes_as_unvalidated(shapes_data: List[SlideShape], reason: str) -> List[SlideShape]:
    """Mark all shapes as unvalidated with error information."""
    validated_shapes = []
    for shape in shapes_data:
        shape_dict = shape.dict()
        shape_dict.update({
            'coordinate_validation_score': None,
            'svg_matched': False,
            'coordinate_source': f'pptx_extraction_only ({reason})',
            'svg_original_x': None,
            'svg_original_y': None
        })
        validated_shapes.append(SlideShape(**shape_dict))
    return validated_shapes


def _extract_svg_dimensions(root) -> Dict[str, Any]:
    """Extract SVG dimensions with better parsing of units and viewBox."""
    svg_info = {
        'width': None,
        'height': None,
        'viewbox': None,
        'units': 'px'
    }
    
    # Get SVG dimensions
    width_attr = root.get('width', '')
    height_attr = root.get('height', '')
    viewbox_attr = root.get('viewBox', '')
    
    # Parse dimensions with unit detection
    if width_attr and height_attr:
        try:
            # Extract numeric value and unit
            width_match = re.match(r'([\d.]+)(\w*)', width_attr.strip())
            height_match = re.match(r'([\d.]+)(\w*)', height_attr.strip())
            
            if width_match and height_match:
                svg_info['width'] = float(width_match.group(1))
                svg_info['height'] = float(height_match.group(1))
                
                # Detect units (pt, px, mm, cm, in)
                unit = width_match.group(2) or 'px'
                svg_info['units'] = unit
                
                # Convert to pixels if needed
                if unit == 'pt':
                    svg_info['width'] = svg_info['width'] * 96 / 72  # Points to pixels
                    svg_info['height'] = svg_info['height'] * 96 / 72
                elif unit == 'mm':
                    svg_info['width'] = svg_info['width'] * 96 / 25.4  # MM to pixels
                    svg_info['height'] = svg_info['height'] * 96 / 25.4
                elif unit == 'cm':
                    svg_info['width'] = svg_info['width'] * 96 / 2.54  # CM to pixels
                    svg_info['height'] = svg_info['height'] * 96 / 2.54
                elif unit == 'in':
                    svg_info['width'] = svg_info['width'] * 96  # Inches to pixels
                    svg_info['height'] = svg_info['height'] * 96
        except Exception as e:
            logger.debug(f"Error parsing SVG dimensions: {e}")
    
    # Parse viewBox if available and dimensions are missing
    if viewbox_attr:
        try:
            viewbox_parts = viewbox_attr.split()
            if len(viewbox_parts) == 4:
                viewbox = [float(x) for x in viewbox_parts]
                svg_info['viewbox'] = viewbox
                
                if not svg_info['width'] or not svg_info['height']:
                    svg_info['width'] = viewbox[2] - viewbox[0]
                    svg_info['height'] = viewbox[3] - viewbox[1]
        except Exception as e:
            logger.debug(f"Error parsing SVG viewBox: {e}")
    
    return svg_info


def _calculate_coordinate_transform(svg_info: Dict[str, Any], slide_width_px: int, slide_height_px: int) -> Dict[str, float]:
    """Calculate coordinate transformation factors with better accuracy."""
    transform_info = {
        'scale_x': 1.0,
        'scale_y': 1.0,
        'offset_x': 0.0,
        'offset_y': 0.0,
        'needs_transform': False
    }
    
    if svg_info['width'] and svg_info['height']:
        transform_info['scale_x'] = svg_info['width'] / slide_width_px
        transform_info['scale_y'] = svg_info['height'] / slide_height_px
        
        # Check if transformation is needed (with small tolerance for floating point errors)
        if abs(transform_info['scale_x'] - 1.0) > 0.001 or abs(transform_info['scale_y'] - 1.0) > 0.001:
            transform_info['needs_transform'] = True
        
        # Handle viewBox offset if present
        if svg_info['viewbox']:
            transform_info['offset_x'] = svg_info['viewbox'][0]
            transform_info['offset_y'] = svg_info['viewbox'][1]
    
    return transform_info


def _extract_svg_text_elements(root, namespaces: Dict[str, str]) -> List[Dict[str, Any]]:
    """Enhanced text element extraction from SVG with better text parsing."""
    svg_text_elements = []
    
    # Look for various text elements that LibreOffice might generate
    text_selectors = [
        'text',
        'tspan',
        './/text',
        './/tspan',
        './/{http://www.w3.org/2000/svg}text',
        './/{http://www.w3.org/2000/svg}tspan'
    ]
    
    processed_texts = set()  # Avoid duplicates
    
    for selector in text_selectors:
        try:
            if selector.startswith('.//'):
                elements = root.findall(selector)
            else:
                elements = root.iter(selector)
            
            for text_elem in elements:
                text_content = _extract_text_content(text_elem)
                if not text_content or text_content in processed_texts:
                    continue
                
                processed_texts.add(text_content)
                
                # Extract position attributes with better parsing
                position_data = _extract_text_position(text_elem)
                if position_data:
                    svg_text_elements.append({
                        'text': text_content,
                        'x': position_data['x'],
                        'y': position_data['y'],
                        'width': position_data.get('width'),
                        'height': position_data.get('height'),
                        'element': text_elem,
                        'style': _extract_text_style(text_elem)
                    })
                    
        except Exception as e:
            logger.debug(f"Error processing text selector {selector}: {e}")
            continue
    
    return svg_text_elements


def _extract_text_content(text_elem) -> str:
    """Extract complete text content from SVG text element including nested tspans."""
    text_parts = []
    
    # Get direct text content
    if text_elem.text:
        text_parts.append(text_elem.text.strip())
    
    # Get text from nested elements (tspan, etc.)
    for child in text_elem:
        if child.text:
            text_parts.append(child.text.strip())
        if child.tail:
            text_parts.append(child.tail.strip())
    
    # Get tail text
    if text_elem.tail:
        text_parts.append(text_elem.tail.strip())
    
    return ' '.join(filter(None, text_parts)).strip()


def _extract_text_position(text_elem) -> Optional[Dict[str, float]]:
    """Extract position and size information from SVG text element."""
    try:
        # Extract x, y coordinates
        x_attr = text_elem.get('x', '0')
        y_attr = text_elem.get('y', '0')
        
        # Handle comma-separated or space-separated coordinates
        x_vals = re.findall(r'[\d.-]+', x_attr)
        y_vals = re.findall(r'[\d.-]+', y_attr)
        
        if not x_vals or not y_vals:
            return None
        
        x_val = float(x_vals[0])
        y_val = float(y_vals[0])
        
        position_data = {'x': x_val, 'y': y_val}
        
        # Try to extract width and height if available
        width_attr = text_elem.get('width')
        height_attr = text_elem.get('height')
        
        if width_attr:
            width_vals = re.findall(r'[\d.-]+', width_attr)
            if width_vals:
                position_data['width'] = float(width_vals[0])
        
        if height_attr:
            height_vals = re.findall(r'[\d.-]+', height_attr)
            if height_vals:
                position_data['height'] = float(height_vals[0])
        
        return position_data
        
    except Exception as e:
        logger.debug(f"Error extracting text position: {e}")
        return None


def _extract_text_style(text_elem) -> Dict[str, str]:
    """Extract style information from SVG text element."""
    style_info = {}
    
    # Get style attribute
    style_attr = text_elem.get('style', '')
    if style_attr:
        # Parse CSS-style properties
        for prop in style_attr.split(';'):
            if ':' in prop:
                key, value = prop.split(':', 1)
                style_info[key.strip()] = value.strip()
    
    # Get individual style attributes
    for attr in ['font-family', 'font-size', 'font-weight', 'fill', 'text-anchor']:
        value = text_elem.get(attr)
        if value:
            style_info[attr] = value
    
    return style_info


def _find_best_svg_text_match(shape_text: str, svg_text_elements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Enhanced text matching with multiple strategies and scoring."""
    if not shape_text or not svg_text_elements:
        return {'score': 0.0, 'match': None, 'strategy': 'no_candidates'}
    
    shape_text_clean = shape_text.strip()
    best_match = None
    best_score = 0.0
    best_strategy = 'no_match'
    
    for svg_text in svg_text_elements:
        svg_text_clean = svg_text['text'].strip()
        
        # Strategy 1: Exact match
        if shape_text_clean == svg_text_clean:
            return {
                'score': 1.0,
                'match': svg_text,
                'strategy': 'exact_match'
            }
        
        # Strategy 2: Case-insensitive exact match
        if shape_text_clean.lower() == svg_text_clean.lower():
            if 0.98 > best_score:
                best_match = svg_text
                best_score = 0.98
                best_strategy = 'case_insensitive_exact'
        
        # Strategy 3: Normalized whitespace match
        shape_normalized = re.sub(r'\s+', ' ', shape_text_clean)
        svg_normalized = re.sub(r'\s+', ' ', svg_text_clean)
        if shape_normalized == svg_normalized:
            if 0.95 > best_score:
                best_match = svg_text
                best_score = 0.95
                best_strategy = 'normalized_whitespace'
        
        # Strategy 4: Substring matching
        if shape_text_clean in svg_text_clean or svg_text_clean in shape_text_clean:
            # Calculate overlap ratio
            longer_text = shape_text_clean if len(shape_text_clean) > len(svg_text_clean) else svg_text_clean
            shorter_text = svg_text_clean if len(shape_text_clean) > len(svg_text_clean) else shape_text_clean
            
            overlap_score = len(shorter_text) / len(longer_text) * 0.9  # Penalty for partial match
            if overlap_score > best_score and overlap_score > 0.7:
                best_match = svg_text
                best_score = overlap_score
                best_strategy = 'substring_match'
        
        # Strategy 5: Word-based similarity
        shape_words = set(shape_text_clean.lower().split())
        svg_words = set(svg_text_clean.lower().split())
        
        if shape_words and svg_words:
            common_words = shape_words & svg_words
            total_words = shape_words | svg_words
            word_similarity = len(common_words) / len(total_words) * 0.85  # Penalty for word-based match
            
            if word_similarity > best_score and word_similarity > 0.6:
                best_match = svg_text
                best_score = word_similarity
                best_strategy = 'word_similarity'
        
        # Strategy 6: Character-based similarity (Jaccard-like)
        if len(shape_text_clean) > 5 and len(svg_text_clean) > 5:  # Only for longer texts
            shape_chars = set(shape_text_clean.lower())
            svg_chars = set(svg_text_clean.lower())
            
            common_chars = shape_chars & svg_chars
            total_chars = shape_chars | svg_chars
            
            if total_chars:
                char_similarity = len(common_chars) / len(total_chars) * 0.75  # Lower weight for char similarity
                
                if char_similarity > best_score and char_similarity > 0.5:
                    best_match = svg_text
                    best_score = char_similarity
                    best_strategy = 'character_similarity'
    
    return {
        'score': best_score,
        'match': best_match,
        'strategy': best_strategy
    }


def _apply_coordinate_validation(
    shape: SlideShape,
    match_result: Dict[str, Any],
    transform_info: Dict[str, float]
) -> SlideShape:
    """Apply coordinate validation and transformation based on SVG match."""
    svg_text = match_result['match']
    
    # Store original SVG coordinates
    svg_original_x = svg_text['x']
    svg_original_y = svg_text['y']
    
    # Apply coordinate transformation if needed
    if transform_info['needs_transform']:
        # Transform SVG coordinates back to slide coordinate space
        adjusted_x = int((svg_original_x - transform_info['offset_x']) / transform_info['scale_x'])
        adjusted_y = int((svg_original_y - transform_info['offset_y']) / transform_info['scale_y'])
    else:
        # Use SVG coordinates directly
        adjusted_x = int(svg_original_x)
        adjusted_y = int(svg_original_y)
    
    # Create updated shape with validated coordinates and metadata
    shape_dict = shape.dict()
    shape_dict.update({
        'x_coordinate': adjusted_x,
        'y_coordinate': adjusted_y,
        'coordinate_validation_score': match_result['score'],
        'svg_matched': True,
        'svg_original_x': svg_original_x,
        'svg_original_y': svg_original_y,
        'coordinate_source': f"svg_validation ({match_result['strategy']})"
    })
    
    return SlideShape(**shape_dict)


def segment_text_for_translation(text: str, max_segment_length: int = 100) -> List[Dict[str, Any]]:
    """
    Segment text into translation-friendly units.
    Breaks text at sentence boundaries while respecting length limits.
    """
    if not text or len(text.strip()) == 0:
        return []

    text = text.strip()
    
    # If text is short enough, return as single segment
    if len(text) <= max_segment_length:
        return [{
            'text': text,
            'segment_index': 0,
            'is_complete_sentence': True,
            'word_count': len(text.split()),
            'char_count': len(text)
        }]

    segments = []
    
    # Split by sentence boundaries
    sentence_endings = r'[.!?]+\s+'
    sentences = re.split(sentence_endings, text)
    
    current_segment = ""
    segment_index = 0
    
    for i, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # If adding this sentence would exceed limit, save current segment
        if current_segment and len(current_segment + " " + sentence) > max_segment_length:
            if current_segment:
                segments.append({
                    'text': current_segment.strip(),
                    'segment_index': segment_index,
                    'is_complete_sentence': True,
                    'word_count': len(current_segment.split()),
                    'char_count': len(current_segment)
                })
                segment_index += 1
                current_segment = sentence
            else:
                # Single sentence is too long, break it at word boundaries
                words = sentence.split()
                temp_segment = ""
                
                for word in words:
                    if temp_segment and len(temp_segment + " " + word) > max_segment_length:
                        segments.append({
                            'text': temp_segment.strip(),
                            'segment_index': segment_index,
                            'is_complete_sentence': False,
                            'word_count': len(temp_segment.split()),
                            'char_count': len(temp_segment)
                        })
                        segment_index += 1
                        temp_segment = word
                    else:
                        temp_segment = temp_segment + " " + word if temp_segment else word
                
                current_segment = temp_segment
        else:
            current_segment = current_segment + " " + sentence if current_segment else sentence

    # Add final segment
    if current_segment:
        segments.append({
            'text': current_segment.strip(),
            'segment_index': segment_index,
            'is_complete_sentence': True,
            'word_count': len(current_segment.split()),
            'char_count': len(current_segment)
        })

    return segments
