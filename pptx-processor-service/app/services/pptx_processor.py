import os
import uuid
import logging
import time
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pptx import Presentation
from PIL import Image
import cairosvg
import json
import shutil

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
from app.services.supabase_service import upload_file_to_supabase, update_job_status
from app.services.job_status import update_job_status as update_local_job_status


logger = logging.getLogger(__name__)


async def queue_pptx_processing(
    job_id: str,
    session_id: str,
    file_path: str,
    supabase_url: str,
    supabase_key: str,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    generate_thumbnails: bool = True
) -> None:
    """
    Queue the PPTX processing task.

    In a production environment, this would dispatch to a task queue like Celery.
    For this implementation, we'll just run the processing directly in a separate thread.
    """
    # Update job status to processing
    await update_local_job_status(
        job_id=job_id,
        status=ProcessingStatusResponse(
            job_id=job_id,
            session_id=session_id,
            status=ProcessingStatus.PROCESSING,
            progress=0,
            current_stage="Starting processing"
        )
    )

    # Run the processing in a background task
    loop = asyncio.get_event_loop()
    loop.create_task(
        process_pptx(
            job_id=job_id,
            session_id=session_id,
            file_path=file_path,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            source_language=source_language,
            target_language=target_language,
            generate_thumbnails=generate_thumbnails
        )
    )


async def process_pptx(
    job_id: str,
    session_id: str,
    file_path: str,
    supabase_url: str,
    supabase_key: str,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    generate_thumbnails: bool = True
) -> None:
    """
    Process a PPTX file:
    1. Convert each slide to SVG
    2. Extract text elements with coordinates and styles
    3. Generate thumbnails (if requested)
    4. Upload assets to Supabase
    5. Return structured data
    """
    start_time = time.time()
    processing_dir = os.path.join(os.path.dirname(file_path), "processing")
    os.makedirs(processing_dir, exist_ok=True)

    try:
        # Open the presentation
        presentation = Presentation(file_path)
        slide_count = len(presentation.slides)

        # Update job status
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.PROCESSING,
                progress=5,
                current_stage=f"Opened presentation with {slide_count} slides"
            )
        )

        # Process each slide
        processed_slides = []
        for idx, slide in enumerate(presentation.slides):
            # Update progress
            progress = 5 + int((idx / slide_count) * 90)
            await update_local_job_status(
                job_id=job_id,
                status=ProcessingStatusResponse(
                    job_id=job_id,
                    session_id=session_id,
                    status=ProcessingStatus.PROCESSING,
                    progress=progress,
                    current_stage=f"Processing slide {idx+1} of {slide_count}"
                )
            )

            # Process the slide
            processed_slide = await process_slide(
                slide=slide,
                slide_number=idx+1,
                processing_dir=processing_dir,
                supabase_url=supabase_url,
                supabase_key=supabase_key,
                session_id=session_id,
                generate_thumbnail=generate_thumbnails
            )

            processed_slides.append(processed_slide)

        # Create the final result
        processing_time = int(time.time() - start_time)
        result = ProcessedPresentation(
            session_id=session_id,
            slide_count=slide_count,
            processing_status=OverallProcessingStatus.COMPLETED,
            processing_time=processing_time,
            slides=processed_slides
        )

        # Save the result
        result_file = os.path.join(processing_dir, f"result_{session_id}.json")
        with open(result_file, "w") as f:
            f.write(result.json())

        # Upload the result to Supabase
        result_url = await upload_file_to_supabase(
            file_path=result_file,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            bucket="processing_results",
            destination_path=f"{session_id}/result.json"
        )

        # Update job status to completed
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.COMPLETED,
                progress=100,
                current_stage="Processing completed",
                completed_at=datetime.now()
            )
        )

        # Update the session status in Supabase
        await update_job_status(
            session_id=session_id,
            status="completed",
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            slide_count=slide_count,
            result_url=result_url
        )

    except Exception as e:
        logger.error(f"Error processing PPTX: {str(e)}")

        # Update job status to failed
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id,
                session_id=session_id,
                status=ProcessingStatus.FAILED,
                progress=0,
                current_stage="Processing failed",
                error=str(e)
            )
        )

        # Update the session status in Supabase
        await update_job_status(
            session_id=session_id,
            status="failed",
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            error=str(e)
        )

    finally:
        # Clean up temporary files
        try:
            shutil.rmtree(os.path.dirname(file_path))
        except Exception as e:
            logger.error(f"Error cleaning up temporary files: {str(e)}")


async def process_slide(
    slide,
    slide_number: int,
    processing_dir: str,
    supabase_url: str,
    supabase_key: str,
    session_id: str,
    generate_thumbnail: bool = True
) -> ProcessedSlide:
    """
    Process a single slide:
    1. Convert the slide to SVG
    2. Extract text elements with coordinates and styles
    3. Generate a thumbnail (if requested)
    4. Upload assets to Supabase
    5. Return structured data
    """
    slide_id = str(uuid.uuid4())
    slide_dir = os.path.join(processing_dir, f"slide_{slide_number}")
    os.makedirs(slide_dir, exist_ok=True)

    # Get slide dimensions
    slide_width = int(slide.slide_width)
    slide_height = int(slide.slide_height)

    # Convert slide to SVG (this is a simplified example - real implementation would be more complex)
    # In a real implementation, this would use a proper library or external tool like LibreOffice
    svg_file = os.path.join(slide_dir, f"slide_{slide_number}.svg")

    # MOCK IMPLEMENTATION - In a real service, this would use actual conversion
    # For now, we're creating a placeholder SVG
    create_placeholder_svg(svg_file, slide_width, slide_height, slide_number)

    # Upload SVG to Supabase
    svg_url = await upload_file_to_supabase(
        file_path=svg_file,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        bucket="slide_visuals",
        destination_path=f"{session_id}/slide_{slide_number}.svg"
    )

    # Generate thumbnail if requested
    thumbnail_url = None
    if generate_thumbnail:
        thumbnail_file = os.path.join(
            slide_dir, f"thumbnail_{slide_number}.png")

        # MOCK IMPLEMENTATION - In a real service, this would generate an actual thumbnail
        create_placeholder_thumbnail(
            thumbnail_file, slide_width, slide_height, slide_number)

        # Upload thumbnail to Supabase
        thumbnail_url = await upload_file_to_supabase(
            file_path=thumbnail_file,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            bucket="slide_visuals",
            destination_path=f"{session_id}/thumbnails/slide_{slide_number}.png"
        )

    # Extract text elements (this is a simplified example - real implementation would be more complex)
    # In a real implementation, this would use proper analysis of the slide's shapes
    shapes = extract_text_elements(slide, slide_width, slide_height)

    # Create and return the processed slide
    return ProcessedSlide(
        slide_id=slide_id,
        slide_number=slide_number,
        svg_url=svg_url,
        original_width=slide_width,
        original_height=slide_height,
        thumbnail_url=thumbnail_url,
        shapes=shapes
    )


def extract_text_elements(slide, slide_width: int, slide_height: int) -> List[SlideShape]:
    """
    Extract text elements from a slide with their coordinates and styles.

    This is a simplified implementation. In a real service, this would use more sophisticated
    analysis of the slide's text frames, tables, charts, etc.
    """
    shapes = []

    # Extract text from shapes with text frames
    for idx, shape in enumerate(slide.shapes):
        if not hasattr(shape, "text"):
            continue

        if not shape.text.strip():
            continue

        # Get shape coordinates (in points)
        left = shape.left
        top = shape.top
        width = shape.width
        height = shape.height

        # Convert coordinates to percentages of slide dimensions
        x_percent = (left / slide_width) * 100
        y_percent = (top / slide_height) * 100
        width_percent = (width / slide_width) * 100
        height_percent = (height / slide_height) * 100

        # Get basic style information (simplified)
        font_size = 12.0
        font_family = "Arial"
        font_weight = "normal"
        font_style = "normal"
        color = "#000000"

        if hasattr(shape, "text_frame") and shape.text_frame.paragraphs:
            # Try to get style from the first run of the first paragraph
            paragraph = shape.text_frame.paragraphs[0]
            if paragraph.runs:
                run = paragraph.runs[0]
                if hasattr(run, "font"):
                    font = run.font
                    if hasattr(font, "size") and font.size:
                        font_size = font.size.pt
                    if hasattr(font, "name") and font.name:
                        font_family = font.name
                    if hasattr(font, "bold") and font.bold:
                        font_weight = "bold"
                    if hasattr(font, "italic") and font.italic:
                        font_style = "italic"
                    # Color extraction would be more complex

        # Create the shape object
        shape_obj = SlideShape(
            shape_id=str(uuid.uuid4()),
            shape_type=ShapeType.TEXT,
            original_text=shape.text,
            x_coordinate=x_percent,
            y_coordinate=y_percent,
            width=width_percent,
            height=height_percent,
            coordinates_unit=CoordinateUnit.PERCENTAGE,
            font_size=font_size,
            font_family=font_family,
            font_weight=font_weight,
            font_style=font_style,
            color=color,
            reading_order=idx + 1
        )

        shapes.append(shape_obj)

    # In a real implementation, we would also extract text from:
    # - Tables (each cell with text)
    # - Charts (titles, labels, etc.)
    # - SmartArt
    # - etc.

    return shapes


def create_placeholder_svg(file_path: str, width: int, height: int, slide_number: int) -> None:
    """
    Create a placeholder SVG file for demonstration purposes.

    In a real implementation, this would be replaced with actual slide-to-SVG conversion.
    """
    # Convert points to pixels for SVG (approximate conversion)
    width_px = int(width * 1.33)
    height_px = int(height * 1.33)

    svg_content = f"""<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg width="{width_px}" height="{height_px}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <rect x="10" y="10" width="{width_px-20}" height="{height_px-20}" fill="#f0f0f0" stroke="#cccccc" stroke-width="1"/>
        <text x="{width_px/2}" y="{height_px/2}" font-family="Arial" font-size="24" text-anchor="middle">Slide {slide_number}</text>
    </svg>
    """

    with open(file_path, "w") as f:
        f.write(svg_content)


def create_placeholder_thumbnail(file_path: str, width: int, height: int, slide_number: int) -> None:
    """
    Create a placeholder thumbnail image for demonstration purposes.

    In a real implementation, this would be replaced with actual thumbnail generation.
    """
    # Create a blank image with the right aspect ratio
    thumbnail_width = 250
    thumbnail_height = int((height / width) * thumbnail_width)

    # Using PIL to create a simple image
    image = Image.new(
        'RGB', (thumbnail_width, thumbnail_height), color=(240, 240, 240))

    # Save the image
    image.save(file_path)
