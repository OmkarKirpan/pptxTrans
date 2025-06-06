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

    # Clean the values - remove inline comments and quotes
    # python-dotenv reads the entire line including comments
    if '#' in url:
        url = url.split('#')[0].strip()
    if '#' in key:
        key = key.split('#')[0].strip()

    # Clean the key - remove whitespace, newlines and quotes
    clean_key = key.strip().replace('\n', '').replace('\r', '')
    if clean_key.startswith('"') and clean_key.endswith('"'):
        clean_key = clean_key[1:-1]

    # Clean the URL - remove quotes
    clean_url = url.strip()
    if clean_url.startswith('"') and clean_url.endswith('"'):
        clean_url = clean_url[1:-1]

    # Normalize the URL to ensure it's properly formatted
    normalized_url = _normalize_supabase_url(clean_url)

    try:
        return create_client(normalized_url, clean_key)
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

    # Clean the values - remove inline comments and quotes
    if '#' in url:
        url = url.split('#')[0].strip()
    if '#' in key:
        key = key.split('#')[0].strip()

    # Remove quotes if present
    if url.startswith('"') and url.endswith('"'):
        url = url[1:-1]
    if key.startswith('"') and key.endswith('"'):
        key = key[1:-1]

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
        logger.debug(f"Checking Supabase connection to: {normalized_url}")

        # Print the first few characters of the key for debugging
        if key and len(key) > 10:
            logger.debug(f"Using API key starting with: {key[:10]}...")

        # Clean the values - remove inline comments
        if '#' in url:
            url = url.split('#')[0].strip()
        if '#' in key:
            key = key.split('#')[0].strip()

        # Clean the key - remove whitespace, newlines and quotes
        clean_key = key.strip().replace('\n', '').replace('\r', '')
        if clean_key.startswith('"') and clean_key.endswith('"'):
            clean_key = clean_key[1:-1]

        # Clean the URL - remove quotes
        clean_url = url.strip()
        if clean_url.startswith('"') and clean_url.endswith('"'):
            clean_url = clean_url[1:-1]

        # Re-normalize after cleaning
        normalized_url = _normalize_supabase_url(clean_url)

        logger.debug(
            f"Key length before cleaning: {len(key)}, after cleaning: {len(clean_key)}")

        try:
            client = create_client(normalized_url, clean_key)
            logger.debug("Successfully created Supabase client")

            # Just try to list buckets as a basic connectivity test
            buckets = client.storage.list_buckets()
            logger.debug(
                f"Successfully listed buckets: {len(buckets)} buckets found")
            return True
        except Exception as e:
            logger.error(f"Error connecting to Supabase: {str(e)}")
            # Try to diagnose the error
            if "API key" in str(e).lower() or "auth" in str(e).lower() or "unauthorized" in str(e).lower():
                logger.error(
                    "This appears to be an API key issue. Check your SUPABASE_KEY value.")
            elif "URL" in str(e).upper() or "host" in str(e).lower() or "connection" in str(e).lower():
                logger.error(
                    "This appears to be a URL/connection issue. Check your SUPABASE_URL value.")
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

        # Check if the bucket exists
        buckets = supabase.storage.list_buckets()
        bucket_exists = any(b["name"] == bucket for b in buckets)

        if not bucket_exists:
            try:
                # Try to create the bucket
                supabase.storage.create_bucket(bucket)
                logger.info(f"Created storage bucket: {bucket}")
            except Exception as bucket_error:
                # If bucket creation fails (likely due to RLS), log but continue
                # The bucket might already exist or need to be created manually
                logger.warning(
                    f"Could not create bucket '{bucket}': {str(bucket_error)}")
                logger.warning(
                    "Please ensure the bucket exists in Supabase Storage and has proper RLS policies")

        # Try to upload the file regardless
        with open(file_path, "rb") as f:
            file_bytes = f.read()

            # First, try to remove any existing file at this path (in case of retry)
            try:
                supabase.storage.from_(bucket).remove([destination_path])
            except:
                pass  # Ignore if file doesn't exist

            # Upload the file
            response = supabase.storage.from_(
                bucket).upload(destination_path, file_bytes)

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
    Retrieve all shapes for a specific slide.
    """
    try:
        supabase = _create_supabase_client()
        response = supabase.table("slide_shapes") \
            .select("*") \
            .eq("slide_id", slide_id) \
            .execute()

        if response.data:
            return response.data
        else:
            logger.warning(f"No shapes found for slide: {slide_id}")
            return []
    except Exception as e:
        logger.error(f"Error retrieving shapes for slide {slide_id}: {str(e)}")
        raise Exception(f"Failed to retrieve shapes for slide: {str(e)}")


async def get_supabase_signed_url(
    bucket: str,
    path: str,
    expiration: Optional[Any] = None
) -> Optional[str]:
    """
    Generate a signed URL for downloading a file from Supabase storage.
    
    Args:
        bucket: The storage bucket name
        path: The file path within the bucket
        expiration: Expiration time for the signed URL (datetime object)
    
    Returns:
        Signed URL string or None if file doesn't exist
    """
    try:
        supabase = _create_supabase_client()
        
        # Calculate expiration in seconds from now if provided
        expires_in = None
        if expiration:
            from datetime import datetime
            if hasattr(expiration, 'timestamp'):
                expires_in = int((expiration - datetime.now()).total_seconds())
            else:
                expires_in = 3600  # Default to 1 hour
        else:
            expires_in = 3600  # Default to 1 hour
        
        # Generate signed URL
        response = supabase.storage.from_(bucket).create_signed_url(
            path=path,
            expires_in=expires_in
        )
        
        if response and 'signedURL' in response:
            return response['signedURL']
        else:
            logger.warning(f"Failed to generate signed URL for {bucket}/{path}")
            return None
            
    except Exception as e:
        logger.error(f"Error generating signed URL for {bucket}/{path}: {str(e)}")
        return None


async def download_from_storage(
    file_path: str,
    bucket: str,
    destination: str
) -> str:
    """
    Download a file from Supabase Storage to a local destination.
    
    Args:
        file_path: Path to the file in Supabase storage
        bucket: The storage bucket name
        destination: Local file path where the file should be saved
    
    Returns:
        Local file path of the downloaded file
    """
    try:
        supabase = _create_supabase_client()
        
        # Download the file
        response = supabase.storage.from_(bucket).download(file_path)
        
        if response:
            # Ensure destination directory exists
            os.makedirs(os.path.dirname(destination), exist_ok=True)
            
            # Write the file to destination
            with open(destination, 'wb') as f:
                f.write(response)
            
            logger.info(f"Successfully downloaded {bucket}/{file_path} to {destination}")
            return destination
        else:
            raise Exception(f"Failed to download file from {bucket}/{file_path}")
            
    except Exception as e:
        logger.error(f"Error downloading file from {bucket}/{file_path}: {str(e)}")
        raise Exception(f"Failed to download file: {str(e)}")
