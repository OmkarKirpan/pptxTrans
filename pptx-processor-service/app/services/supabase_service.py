import os
import logging
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from app.core.config import get_settings
import urllib.parse

logger = logging.getLogger(__name__)
settings = get_settings()


def _normalize_supabase_url(url: str) -> str:
    """
    Normalize Supabase URL to ensure it's properly formatted.
    """
    if not url:
        return ""

    # Ensure URL has a scheme
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    # Parse and reconstruct to normalize
    parsed = urllib.parse.urlparse(url)

    # Remove trailing slashes
    normalized_url = f"{parsed.scheme}://{parsed.netloc.rstrip('/')}"
    if parsed.path and parsed.path != '/':
        normalized_url += parsed.path.rstrip('/')

    return normalized_url


def _create_supabase_client(supabase_url: Optional[str] = None, supabase_key: Optional[str] = None) -> Client:
    """
    Create a Supabase client with proper error handling.
    Uses the provided credentials or falls back to settings if not provided.
    """
    url = supabase_url or settings.SUPABASE_URL
    key = supabase_key or settings.SUPABASE_KEY

    if not url:
        raise ValueError("Supabase URL is not configured")
    if not key:
        raise ValueError("Supabase API key is not configured")

    # Normalize the URL to ensure it's properly formatted
    normalized_url = _normalize_supabase_url(url)

    try:
        return create_client(normalized_url, key)
    except Exception as e:
        logger.error(f"Error creating Supabase client: {str(e)}")
        raise Exception(f"Failed to create Supabase client: {str(e)}")


async def validate_supabase_credentials(supabase_url: Optional[str] = None, supabase_key: Optional[str] = None) -> bool:
    """
    Validate that the Supabase credentials are valid.
    Uses the provided credentials or falls back to settings if not provided.
    """
    url = supabase_url or settings.SUPABASE_URL
    key = supabase_key or settings.SUPABASE_KEY

    if not url:
        raise ValueError("Supabase URL is not configured")
    if not key:
        raise ValueError("Supabase API key is not configured")

    # Normalize the URL to ensure it's properly formatted
    normalized_url = _normalize_supabase_url(url)

    try:
        client = create_client(normalized_url, key)
        # Simply check if we can create a client and get a response
        # This is a lightweight check that doesn't require specific permissions
        storage_buckets = client.storage.list_buckets()
        return True
    except Exception as e:
        logger.error(f"Error validating Supabase credentials: {str(e)}")
        raise Exception(f"Invalid Supabase credentials: {str(e)}")


async def check_supabase_connection(supabase_url: Optional[str] = None, supabase_key: Optional[str] = None) -> bool:
    """
    Check if we can connect to Supabase.
    Uses the provided credentials or falls back to settings if not provided.
    """
    try:
        url = supabase_url or settings.SUPABASE_URL
        key = supabase_key or settings.SUPABASE_KEY

        if not url or not key:
            logger.warning("Supabase credentials not configured")
            return False

        # Normalize the URL to ensure it's properly formatted
        normalized_url = _normalize_supabase_url(url)

        try:
            client = create_client(normalized_url, key)

            # Just try to list buckets as a basic connectivity test
            client.storage.list_buckets()
            return True
        except Exception as e:
            logger.error(f"Error connecting to Supabase: {str(e)}")
            return False
    except Exception as e:
        logger.error(
            f"Unexpected error in check_supabase_connection: {str(e)}")
        return False


async def upload_file_to_supabase(
    file_path: str,
    bucket: str,
    destination_path: str
) -> str:
    """
    Upload a file to Supabase Storage and return the public URL.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Check if the bucket exists, create it if not
        buckets = supabase.storage.list_buckets()
        bucket_exists = any(b["name"] == bucket for b in buckets)

        if not bucket_exists:
            supabase.storage.create_bucket(bucket)

        # Upload the file
        with open(file_path, "rb") as f:
            file_bytes = f.read()
            supabase.storage.from_(bucket).upload(destination_path, file_bytes)

        # Get the public URL
        file_url = supabase.storage.from_(
            bucket).get_public_url(destination_path)

        return file_url

    except Exception as e:
        logger.error(f"Error uploading file to Supabase: {str(e)}")
        raise Exception(f"Failed to upload file to Supabase: {str(e)}")


async def update_job_status(
    session_id: str,
    status: str,
    slide_count: Optional[int] = None,
    result_url: Optional[str] = None,
    error: Optional[str] = None
) -> None:
    """
    Update the status of a translation session in Supabase.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Prepare the update data
        data = {"status": status}

        if slide_count is not None:
            data["slide_count"] = slide_count

        if result_url is not None:
            data["result_url"] = result_url

        if error is not None:
            data["error"] = error

        # Update the session record
        supabase.table("translation_sessions").update(
            data).eq("id", session_id).execute()

    except Exception as e:
        logger.error(f"Error updating job status in Supabase: {str(e)}")
        # We don't want to raise an exception here, as this is a non-critical operation
        # that should not fail the entire processing pipeline


async def save_slide_data(
    session_id: str,
    slide_data: Dict[str, Any]
) -> str:
    """
    Save slide data to the slides table in Supabase.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Prepare the slide data
        data = {
            "session_id": session_id,
            "slide_number": slide_data["slide_number"],
            "svg_url": slide_data["svg_url"],
            "original_width": slide_data["original_width"],
            "original_height": slide_data["original_height"],
            "thumbnail_url": slide_data.get("thumbnail_url")
        }

        # Insert the slide record
        response = supabase.table("slides").insert(data).execute()

        # Return the inserted slide ID
        return response.data[0]["id"]

    except Exception as e:
        logger.error(f"Error saving slide data to Supabase: {str(e)}")
        raise Exception(f"Failed to save slide data to Supabase: {str(e)}")


async def save_slide_shapes(
    slide_id: str,
    shapes: List[Dict[str, Any]]
) -> None:
    """
    Save slide shape data to the slide_shapes table in Supabase.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Prepare the shape data
        data = []
        for shape in shapes:
            shape_data = {
                "slide_id": slide_id,
                "shape_type": shape["shape_type"],
                "original_text": shape["original_text"],
                "x_coordinate": shape["x_coordinate"],
                "y_coordinate": shape["y_coordinate"],
                "width": shape["width"],
                "height": shape["height"],
                "coordinates_unit": shape["coordinates_unit"],
                "font_size": shape.get("font_size"),
                "font_family": shape.get("font_family"),
                "font_weight": shape.get("font_weight"),
                "font_style": shape.get("font_style"),
                "color": shape.get("color"),
                "reading_order": shape.get("reading_order")
            }
            data.append(shape_data)

        # Insert the shape records
        if data:
            supabase.table("slide_shapes").insert(data).execute()

    except Exception as e:
        logger.error(f"Error saving slide shapes to Supabase: {str(e)}")
        raise Exception(f"Failed to save slide shapes to Supabase: {str(e)}")


async def get_session_details(
    session_id: str
) -> Dict[str, Any]:
    """
    Get details of a translation session from Supabase.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Query the session record
        response = supabase.table("translation_sessions").select(
            "*").eq("id", session_id).execute()

        if not response.data:
            raise FileNotFoundError(f"Session not found: {session_id}")

        return response.data[0]

    except Exception as e:
        logger.error(f"Error getting session details from Supabase: {str(e)}")
        raise Exception(
            f"Failed to get session details from Supabase: {str(e)}")


async def get_slides_for_session(
    session_id: str
) -> List[Dict[str, Any]]:
    """
    Get all slides for a translation session from Supabase.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Query the slides for the session
        response = supabase.table("slides").select(
            "*").eq("session_id", session_id).order("slide_number").execute()

        return response.data

    except Exception as e:
        logger.error(f"Error getting slides from Supabase: {str(e)}")
        raise Exception(f"Failed to get slides from Supabase: {str(e)}")


async def get_shapes_for_slide(
    slide_id: str
) -> List[Dict[str, Any]]:
    """
    Get all shapes for a slide from Supabase.
    Uses Supabase credentials from settings.
    """
    try:
        supabase = _create_supabase_client()

        # Query the shapes for the slide
        response = supabase.table("slide_shapes").select(
            "*").eq("slide_id", slide_id).order("reading_order").execute()

        return response.data

    except Exception as e:
        logger.error(f"Error getting shapes from Supabase: {str(e)}")
        raise Exception(f"Failed to get shapes from Supabase: {str(e)}")
