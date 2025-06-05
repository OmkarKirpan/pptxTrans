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
import xml.etree.ElementTree as ET
from pptx.enum.text import PP_ALIGN, MSO_VERTICAL_ANCHOR
from pptx.util import Emu, Pt
import base64
from pptx.enum.shapes import MSO_SHAPE_TYPE
import subprocess
import tempfile
import glob

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
from app.services.job_status import update_job_status as update_local_job_status, get_job_status
# Import get_settings instead of settings
from app.core.config import get_settings

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
    Queue the PPTX processing task.
    """
    # Store the file path for potential retry
    _job_file_paths[job_id] = file_path

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
    loop = asyncio.get_event_loop()
    loop.create_task(
        process_pptx(
            job_id=job_id,
            session_id=session_id,
            file_path=file_path,
            source_language=source_language,
            target_language=target_language,
            generate_thumbnails=generate_thumbnails
        )
    )


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
    No fallbacks - if LibreOffice fails, processing fails.
    """
    start_time = time.time()
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
            json.dump(result.dict(), f, indent=4)

        result_url = await upload_file_to_supabase(
            file_path=result_file,
            bucket="processing-results", 
            destination_path=f"{session_id}/result.json"
        )

        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id, session_id=session_id, status=ProcessingStatus.COMPLETED,
                progress=100, current_stage="Processing completed", completed_at=datetime.now()
            )
        )
        
        await update_job_status(
            session_id=session_id, 
            status="completed",
            slide_count=slide_count, 
            result_url=result_url
        )

    except Exception as e:
        logger.error(f"Error processing PPTX: {str(e)}", exc_info=True)
        await update_local_job_status(
            job_id=job_id,
            status=ProcessingStatusResponse(
                job_id=job_id, session_id=session_id, status=ProcessingStatus.FAILED,
                progress=0, current_stage="Processing failed", error=str(e)
            )
        )
        await update_job_status(
            session_id=session_id, status="failed", error=str(e)
        )
        raise  # Re-raise to ensure proper error propagation
        
    finally:
        # Clean up temporary files
        try:
            if os.path.exists(uploaded_file_dir):
                status = await get_job_status(job_id)
                if status and status.status not in ["queued", "processing"]:
                    shutil.rmtree(uploaded_file_dir)
                    logger.info(f"Cleaned up temporary processing directory: {uploaded_file_dir}")
                    
                    # Remove from job file paths cache
                    if job_id in _job_file_paths:
                        del _job_file_paths[job_id]
        except Exception as e:
            logger.error(f"Error cleaning up temporary files at {uploaded_file_dir}: {str(e)}")


async def process_slide_simplified(
    slide,  # python-pptx Slide object
    slide_number: int,
    svg_path: str,  # Path to LibreOffice-generated SVG
    session_id: str,
    generate_thumbnail: bool = True
) -> ProcessedSlide:
    """
    Process a single slide using simplified LibreOffice-only approach.
    Enhanced text extraction optimized for translation workflows.
    """
    slide_id = str(uuid.uuid4())

    # Get slide dimensions
    presentation = slide.part.package.presentation_part.presentation
    slide_width_emu = presentation.slide_width
    slide_height_emu = presentation.slide_height

    # Enhanced text extraction optimized for translation
    extracted_shapes_data = extract_shapes_enhanced(slide, slide_width_emu, slide_height_emu)

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
            slide, extracted_shapes_data, thumbnail_file, slide_width_emu, slide_height_emu
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
                "placeholder_type": placeholder_type
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
                    "translation_priority": 1  # Low priority for images
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
