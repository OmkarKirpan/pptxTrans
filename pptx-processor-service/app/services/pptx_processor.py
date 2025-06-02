import os
import uuid
import logging
import time
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pptx import Presentation
from PIL import Image
import json
import shutil
import xml.etree.ElementTree as ET
from pptx.enum.text import PP_ALIGN, MSO_VERTICAL_ANCHOR
from pptx.util import Emu, Pt
import base64
from pptx.enum.shapes import MSO_SHAPE_TYPE

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

    For this simplified implementation, we'll just run the processing directly as a background task.
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

    # Convert slide to SVG
    svg_file = os.path.join(slide_dir, f"slide_{slide_number}.svg")

    # Generate actual SVG using direct XML generation
    create_svg_from_slide(slide, svg_file, slide_width,
                          slide_height, slide_number)

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

        # Generate actual thumbnail using PIL
        create_thumbnail_from_slide(
            slide, thumbnail_file, slide_width, slide_height)

        # Upload thumbnail to Supabase
        thumbnail_url = await upload_file_to_supabase(
            file_path=thumbnail_file,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            bucket="slide_visuals",
            destination_path=f"{session_id}/thumbnails/slide_{slide_number}.png"
        )

    # Extract shapes (text and images)
    extracted_shapes_data = extract_shapes(slide, slide_width, slide_height)

    # Create and return the processed slide
    return ProcessedSlide(
        slide_id=slide_id,
        slide_number=slide_number,
        svg_url=svg_url,
        original_width=slide_width,
        original_height=slide_height,
        thumbnail_url=thumbnail_url,
        shapes=extracted_shapes_data
    )


def extract_shapes(slide, slide_width: int, slide_height: int) -> List[SlideShape]:
    """
    Extract text and image shapes from a slide with their coordinates and styles.
    """
    shapes_data = []

    for idx, shape in enumerate(slide.shapes):
        # Get common shape properties (EMU)
        shape_left_emu = shape.left
        shape_top_emu = shape.top
        shape_width_emu = shape.width
        shape_height_emu = shape.height

        # Convert EMU to points for internal calculations if needed, then to percentage
        # slide_width and slide_height are passed in EMU
        x_percent = (shape_left_emu / slide_width) * \
            100 if slide_width > 0 else 0
        y_percent = (shape_top_emu / slide_height) * \
            100 if slide_height > 0 else 0
        width_percent = (shape_width_emu / slide_width) * \
            100 if slide_width > 0 else 0
        height_percent = (shape_height_emu / slide_height) * \
            100 if slide_height > 0 else 0

        shape_obj_data = {
            "shape_id": str(uuid.uuid4()),
            "x_coordinate": x_percent,
            "y_coordinate": y_percent,
            "width": width_percent,
            "height": height_percent,
            "coordinates_unit": CoordinateUnit.PERCENTAGE,
            "reading_order": idx + 1
        }

        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            image = shape.image
            image_bytes = image.blob
            image_base64_str = base64.b64encode(image_bytes).decode('utf-8')

            shape_obj_data.update({
                "shape_type": ShapeType.IMAGE,
                "original_text": None,  # No text for a pure image shape
                "image_content_type": image.content_type,
                "image_base64": image_base64_str
            })
            shapes_data.append(SlideShape(**shape_obj_data))

        elif shape.has_text_frame:
            text_frame = shape.text_frame
            if not text_frame.text or not text_frame.text.strip():
                continue  # Skip text frames with no actual text

            # Initialize style information with defaults
            font_size_pt = 12.0
            font_family = "Arial"
            font_weight = "normal"
            font_style = "normal"
            hex_color = "#000000"
            text_align_str = "LEFT"
            vertical_anchor_str = "TOP"
            line_spacing_val = 1.0

            if text_frame.paragraphs:
                first_paragraph = text_frame.paragraphs[0]
                if first_paragraph.alignment:
                    if first_paragraph.alignment == PP_ALIGN.LEFT:
                        text_align_str = "LEFT"
                    elif first_paragraph.alignment == PP_ALIGN.CENTER:
                        text_align_str = "CENTER"
                    elif first_paragraph.alignment == PP_ALIGN.RIGHT:
                        text_align_str = "RIGHT"
                    elif first_paragraph.alignment == PP_ALIGN.JUSTIFY:
                        text_align_str = "JUSTIFY"

                if first_paragraph.line_spacing:
                    if isinstance(first_paragraph.line_spacing, float):
                        line_spacing_val = first_paragraph.line_spacing
                    elif hasattr(first_paragraph.line_spacing, 'pt'):
                        base_font_size_for_spacing = 12
                        line_spacing_val = first_paragraph.line_spacing.pt / base_font_size_for_spacing

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
                        if font.color.type == 1 and font.color.rgb:  # MSO_COLOR_TYPE.RGB
                            hex_color = f"#{font.color.rgb[0]:02x}{font.color.rgb[1]:02x}{font.color.rgb[2]:02x}"

            if text_frame.vertical_anchor:
                if text_frame.vertical_anchor == MSO_VERTICAL_ANCHOR.TOP:
                    vertical_anchor_str = "TOP"
                elif text_frame.vertical_anchor == MSO_VERTICAL_ANCHOR.MIDDLE:
                    vertical_anchor_str = "MIDDLE"
                elif text_frame.vertical_anchor == MSO_VERTICAL_ANCHOR.BOTTOM:
                    vertical_anchor_str = "BOTTOM"

            shape_obj_data.update({
                "shape_type": ShapeType.TEXT,
                "original_text": text_frame.text,
                "font_size": font_size_pt,
                "font_family": font_family,
                "font_weight": font_weight,
                "font_style": font_style,
                "color": hex_color,
                "text_align": text_align_str,
                "vertical_anchor": vertical_anchor_str,
                "line_spacing": line_spacing_val,
            })
            shapes_data.append(SlideShape(**shape_obj_data))
        # Add other shape type handling here if needed (e.g., tables, charts as text initially)

    return shapes_data


def create_svg_from_slide(slide, file_path: str, width_emu: int, height_emu: int, slide_number: int) -> None:
    """
    Create an SVG representation of a PowerPoint slide using XML generation.
    Handles text and image shapes.
    """
    # EMU_PER_INCH, DPI, POINTS_PER_INCH constants remain the same
    EMU_PER_INCH = 914400
    DPI = 96
    POINTS_PER_INCH = 72

    width_px = int((width_emu / EMU_PER_INCH) * DPI)
    height_px = int((height_emu / EMU_PER_INCH) * DPI)

    svg_root = ET.Element('svg')
    svg_root.set('xmlns', 'http://www.w3.org/2000/svg')
    # Add xlink namespace for images
    svg_root.set('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    svg_root.set('width', str(width_px))
    svg_root.set('height', str(height_px))
    svg_root.set('viewBox', f'0 0 {width_px} {height_px}')

    background = ET.SubElement(svg_root, 'rect')
    background.set('width', '100%')
    background.set('height', '100%')
    background.set('fill', '#ffffff')

    border = ET.SubElement(svg_root, 'rect')
    border.set('x', '1')
    border.set('y', '1')
    border.set('width', str(width_px - 2))
    border.set('height', str(height_px - 2))
    border.set('fill', 'none')
    border.set('stroke', '#e0e0e0')
    border.set('stroke-width', '1')

    # Fetch all shapes (text and images) once
    all_shapes_data = extract_shapes(slide, width_emu, height_emu)

    for shape_data in all_shapes_data:
        x_px_shape = int((shape_data.x_coordinate / 100) * width_px)
        y_px_shape = int((shape_data.y_coordinate / 100) * height_px)
        w_px_shape = int((shape_data.width / 100) * width_px)
        h_px_shape = int((shape_data.height / 100) * height_px)

        if shape_data.shape_type == ShapeType.IMAGE and shape_data.image_base64:
            image_element = ET.SubElement(svg_root, 'image')
            image_element.set('x', str(x_px_shape))
            image_element.set('y', str(y_px_shape))
            image_element.set('width', str(w_px_shape))
            image_element.set('height', str(h_px_shape))
            image_element.set(
                'xlink:href', f"data:{shape_data.image_content_type};base64,{shape_data.image_base64}")
            # TODO: Add preserveAspectRatio if needed

        elif shape_data.shape_type == ShapeType.TEXT and shape_data.original_text:
            text_container = ET.SubElement(svg_root, 'g')
            text_container.set('class', 'text-shape')
            text_container.set('id', shape_data.shape_id)

            text_bg = ET.SubElement(text_container, 'rect')
            text_bg.set('x', str(x_px_shape))
            text_bg.set('y', str(y_px_shape))
            text_bg.set('width', str(w_px_shape))
            text_bg.set('height', str(h_px_shape))
            text_bg.set('fill', '#f0f0f0')
            text_bg.set('stroke', '#cccccc')
            text_bg.set('stroke-width', '0.5')
            text_bg.set('rx', '1')
            text_bg.set('ry', '1')

            text_element = ET.SubElement(text_container, 'text')
            text_element.set('font-family', shape_data.font_family or "Arial")
            font_size_px = int((shape_data.font_size or 12.0)
                               * (DPI / POINTS_PER_INCH))
            text_element.set('font-size', str(font_size_px))
            if shape_data.font_weight == "bold":
                text_element.set('font-weight', 'bold')
            if shape_data.font_style == "italic":
                text_element.set('font-style', 'italic')
            text_element.set('fill', shape_data.color or "#000000")

            text_anchor = "start"
            base_x_for_text_element = x_px_shape + 5
            if shape_data.text_align == "CENTER":
                text_anchor = "middle"
                base_x_for_text_element = x_px_shape + (w_px_shape / 2)
            elif shape_data.text_align == "RIGHT":
                text_anchor = "end"
                base_x_for_text_element = x_px_shape + w_px_shape - 5
            text_element.set('text-anchor', text_anchor)
            text_element.set('x', str(base_x_for_text_element))

            dominant_baseline = "auto"
            y_offset_factor = 0.3
            if font_size_px > h_px_shape and h_px_shape > 0:
                y_offset_factor = 0.1 + (h_px_shape / font_size_px) * 0.1
            elif h_px_shape <= 0:
                y_offset_factor = 0.0

            if shape_data.vertical_anchor == "MIDDLE":
                dominant_baseline = "middle"
                y_offset_factor = 0.5
            elif shape_data.vertical_anchor == "BOTTOM":
                dominant_baseline = "text-after-edge"
                y_offset_factor = 0.9
            text_element.set('dominant-baseline', dominant_baseline)

            first_line_y = y_px_shape + (h_px_shape * y_offset_factor)
            if dominant_baseline == "auto":
                first_line_y = y_px_shape + font_size_px
            if shape_data.vertical_anchor == "MIDDLE":
                first_line_y = y_px_shape + (h_px_shape / 2)
            elif shape_data.vertical_anchor == "BOTTOM":
                first_line_y = y_px_shape + h_px_shape - (font_size_px * 0.2)
            text_element.set('y', str(first_line_y))

            lines = shape_data.original_text.splitlines()
            line_spacing_multiplier = shape_data.line_spacing or 1.15
            actual_line_height_px = font_size_px * line_spacing_multiplier

            for i, line_text in enumerate(lines):
                tspan = ET.SubElement(text_element, 'tspan')
                tspan.text = line_text if line_text else ' '.encode('utf-8')
                tspan.set('x', str(base_x_for_text_element))
                if i > 0:
                    tspan.set('dy', str(actual_line_height_px))

            if not lines:
                tspan = ET.SubElement(text_element, 'tspan')
                tspan.text = ' '.encode('utf-8')
                tspan.set('x', str(base_x_for_text_element))

    # Convert to string and write to file
    tree = ET.ElementTree(svg_root)
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    tree.write(file_path, encoding='utf-8', xml_declaration=True)


def create_thumbnail_from_slide(slide, file_path: str, width: int, height: int) -> None:
    """
    Create a thumbnail image for the slide using PIL.
    """
    # Create a blank image with the right aspect ratio
    thumbnail_width = 250
    thumbnail_height = int((height / width) * thumbnail_width)

    # Create a white background image
    image = Image.new(
        'RGB', (thumbnail_width, thumbnail_height), color=(255, 255, 255))

    # Use PIL's drawing capabilities to sketch the slide content
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(image)

    # Draw slide border
    draw.rectangle(
        [(1, 1), (thumbnail_width-2, thumbnail_height-2)],
        outline=(200, 200, 200)
    )

    # Draw text shapes as blocks
    for shape_idx, shape in enumerate(slide.shapes):
        if hasattr(shape, 'text') and shape.text.strip():
            # Calculate position as percentage of slide and apply to thumbnail
            left_percent = shape.left / width
            top_percent = shape.top / height
            width_percent = shape.width / width
            height_percent = shape.height / height

            # Convert to thumbnail coordinates
            x = int(left_percent * thumbnail_width)
            y = int(top_percent * thumbnail_height)
            w = int(width_percent * thumbnail_width)
            h = int(height_percent * thumbnail_height)

            # Draw text block
            draw.rectangle([(x, y), (x+w, y+h)], fill=(240,
                           240, 240), outline=(180, 180, 180))

            # Add text representation (first few chars)
            if len(shape.text) > 0:
                text_preview = shape.text[:10] + \
                    ('...' if len(shape.text) > 10 else '')
                try:
                    # Try to use a default font
                    draw.text((x+2, y+2), text_preview, fill=(100, 100, 100))
                except:
                    # If font issues, just draw a line
                    draw.line([(x+2, y+h//2), (x+w-2, y+h//2)],
                              fill=(100, 100, 100))

    # Save the image
    image.save(file_path)
