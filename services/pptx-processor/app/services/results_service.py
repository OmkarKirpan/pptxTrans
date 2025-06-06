import logging
import json
import requests
from typing import Dict, Any, List, Optional

from app.models.schemas import ProcessedPresentation
from app.services.supabase_service import (
    get_session_details,
    get_slides_for_session,
    get_shapes_for_slide
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_processing_results(
    session_id: str
) -> ProcessedPresentation:
    """
    Get the results of a processing job.

    This can either:
    1. Load the results from a JSON file stored in Supabase (faster, if available)
    2. Reconstruct the results from the database tables (slides and slide_shapes)
    """
    try:
        # First, try to get the session details to get the result URL
        session = await get_session_details(session_id)

        # If the session has a result URL, download and parse it
        if "result_url" in session and session["result_url"]:
            return await _get_results_from_json_url(session["result_url"])

        # Otherwise, reconstruct from database
        return await _reconstruct_results_from_database(session_id)

    except FileNotFoundError:
        # Propagate the FileNotFoundError
        raise

    except Exception as e:
        logger.error(f"Error getting processing results: {str(e)}")
        raise Exception(f"Failed to get processing results: {str(e)}")


async def _get_results_from_json_url(result_url: str) -> ProcessedPresentation:
    """
    Download and parse the results JSON from a URL.
    """
    try:
        response = requests.get(result_url)
        response.raise_for_status()

        result_json = response.json()
        return ProcessedPresentation.parse_obj(result_json)

    except Exception as e:
        logger.error(f"Error getting results from JSON URL: {str(e)}")
        raise Exception(f"Failed to get results from JSON URL: {str(e)}")


async def _get_results_from_local_file(session_id: str) -> ProcessedPresentation:
    """
    Load the results from a local JSON file.
    """
    try:
        with open(f"./processing/{session_id}/result_{session_id}.json", "r") as f:
            result_json = json.load(f)
            return ProcessedPresentation.parse_obj(result_json)

    except FileNotFoundError:
        raise FileNotFoundError(f"Results not found for session: {session_id}")

    except Exception as e:
        logger.error(f"Error getting results from local file: {str(e)}")
        raise Exception(f"Failed to get results from local file: {str(e)}")


async def _reconstruct_results_from_database(
    session_id: str
) -> ProcessedPresentation:
    """
    Reconstruct the results from the database tables.
    """
    try:
        # Get session details
        session = await get_session_details(session_id)

        # Get all slides for the session
        slides_data = await get_slides_for_session(session_id)

        if not slides_data:
            raise FileNotFoundError(
                f"No slides found for session: {session_id}")

        # Process each slide
        processed_slides = []
        for slide_data in slides_data:
            # Get shapes for the slide
            shapes_data = await get_shapes_for_slide(slide_data["id"])

            # Convert shapes data to SlideShape objects
            shapes = []
            for shape_data in shapes_data:
                shape = {
                    "shape_id": shape_data["id"],
                    "shape_type": shape_data["shape_type"],
                    "original_text": shape_data["original_text"],
                    "x_coordinate": shape_data["x_coordinate"],
                    "y_coordinate": shape_data["y_coordinate"],
                    "width": shape_data["width"],
                    "height": shape_data["height"],
                    "coordinates_unit": shape_data["coordinates_unit"],
                }

                # Add optional fields if they exist
                for field in ["font_size", "font_family", "font_weight", "font_style", "color", "reading_order"]:
                    if field in shape_data and shape_data[field] is not None:
                        shape[field] = shape_data[field]

                shapes.append(shape)

            # Create ProcessedSlide object
            processed_slide = {
                "slide_id": slide_data["id"],
                "slide_number": slide_data["slide_number"],
                "svg_url": slide_data["svg_url"],
                "original_width": slide_data["original_width"],
                "original_height": slide_data["original_height"],
                "shapes": shapes,
            }

            # Add thumbnail_url if it exists
            if "thumbnail_url" in slide_data and slide_data["thumbnail_url"]:
                processed_slide["thumbnail_url"] = slide_data["thumbnail_url"]

            processed_slides.append(processed_slide)

        # Create ProcessedPresentation object
        result = {
            "session_id": session_id,
            "slide_count": len(processed_slides),
            "processing_status": "completed" if session["status"] == "completed" else "partially_completed",
            "slides": processed_slides,
        }

        return ProcessedPresentation.parse_obj(result)

    except FileNotFoundError:
        # Propagate the FileNotFoundError
        raise

    except Exception as e:
        logger.error(f"Error reconstructing results from database: {str(e)}")
        raise Exception(
            f"Failed to reconstruct results from database: {str(e)}")
