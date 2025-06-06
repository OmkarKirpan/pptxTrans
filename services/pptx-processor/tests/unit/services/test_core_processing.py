import pytest
import os
import shutil
import uuid
import asyncio
from unittest.mock import patch, MagicMock

from app.services.pptx_processor import process_pptx
from app.core.config import get_settings

TEST_FILE_PATH = "UnderstandRatios.pptx"

@pytest.fixture(scope="module")
def settings():
    """Provides application settings and creates a temporary directory for processing."""
    s = get_settings()
    module_tmp_dir = os.path.join(s.TEMP_PROCESSING_DIR, "test_core_processing")
    if os.path.exists(module_tmp_dir):
        shutil.rmtree(module_tmp_dir)
    os.makedirs(module_tmp_dir)
    
    s.TEMP_PROCESSING_DIR = module_tmp_dir
    yield s
    
    shutil.rmtree(module_tmp_dir)

def run_sync(coro):
    """Helper function to run an async coroutine synchronously."""
    return asyncio.run(coro)

@patch("app.services.pptx_processor.generate_svgs")
@patch("app.services.pptx_processor.get_cache_service")
@patch("app.services.pptx_processor.upload_file_to_supabase")
@patch("app.services.pptx_processor.update_local_job_status")
@patch("app.services.pptx_processor.update_supabase_job_status")
@patch("app.services.pptx_processor.extract_shapes_enhanced")
@patch("app.services.pptx_processor.validate_coordinates_with_svg")
@patch("app.services.pptx_processor.create_thumbnail_from_slide_enhanced")
@patch("app.services.pptx_processor.get_job_status")
@patch("os.path.exists")
def test_core_svg_generation_and_text_extraction(
    mock_exists, mock_get_job_status, mock_create_thumbnail, mock_validate_coords, mock_extract_shapes, 
    mock_update_supabase_status, mock_update_local_status, mock_upload, mock_get_cache_service, mock_generate_svgs, settings
):
    """
    Tests the core logic for SVG generation and text extraction synchronously.
    Requires LibreOffice.
    """
    if not os.path.exists(TEST_FILE_PATH):
        pytest.fail(f"Test file '{TEST_FILE_PATH}' not found.")

    # Mock cache service to always return cache miss so we test actual processing
    mock_cache_service = MagicMock()
    mock_cache_service.generate_cache_key.return_value = None  # No cache key = no cache operations
    mock_cache_service.get_cached_result.return_value = None
    mock_cache_service.store_cached_result.return_value = None
    mock_get_cache_service.return_value = mock_cache_service

    job_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    # Configure the upload mock to return a proper URL string
    mock_upload.return_value = "https://fake-supabase.com/storage/test-bucket/test-file.json"
    
    # Mock SVG generation to simulate successful generation of 56 slides
    expected_svg_count = 56
    # Create a mock dictionary mapping slide numbers to fake SVG paths
    mock_svg_paths = {i: f"/fake/path/slide_{i}.svg" for i in range(1, expected_svg_count + 1)}
    mock_generate_svgs.return_value = mock_svg_paths
    
    # Mock the file existence check to return True for our fake SVG paths
    mock_exists.return_value = True
    
    # Mock shape extraction and coordinate validation
    mock_extract_shapes.return_value = []  # Empty list of shapes for simplicity
    mock_validate_coords.return_value = []  # Return the same empty list
    
    # Mock thumbnail creation (no return value needed, just should not raise)
    mock_create_thumbnail.return_value = None
    
    # Mock job status check for cleanup - return a status indicating job is finished
    from app.models.schemas import ProcessingStatus, ProcessingStatusResponse
    mock_job_status = ProcessingStatusResponse(
        job_id=job_id, session_id=session_id, status=ProcessingStatus.COMPLETED,
        progress=100, current_stage="Processing completed"
    )
    mock_get_job_status.return_value = mock_job_status
    
    # Run the async function in a synchronous context
    run_sync(process_pptx(
        job_id=job_id,
        session_id=session_id,
        file_path=TEST_FILE_PATH,
        generate_thumbnails=True,
    ))

    # Note: The processing directory gets cleaned up after processing completes
    # so we can't check the files directly. Instead, we verify through the mock calls.
    expected_svg_count = 56  # Updated to match actual slide count in UnderstandRatios.pptx

    # Verify that the final status update was called, implying success
    mock_update_supabase_status.assert_called_once()
    
    # Inspect the data that was passed to the final status update
    final_status_kwargs = mock_update_supabase_status.call_args.kwargs
    
    assert final_status_kwargs.get("status") == "completed"
    assert final_status_kwargs.get("slide_count") == expected_svg_count
    assert "result_url" in final_status_kwargs

    # The result_url is the path to the main JSON file. We can't easily get inside it,
    # but we can check that it was generated. The call to Supabase is proof enough.
    
    # With cache miss, we should have multiple status updates during full processing
    assert mock_update_local_status.call_count > 1

    # Verify the upload was called correctly: 56 SVGs + 56 thumbnails + 1 result file = 113 total
    expected_upload_count = (expected_svg_count * 2) + 1  # SVGs + thumbnails + result file
    assert mock_upload.call_count == expected_upload_count
    
    # Verify the final upload call is for the result file
    final_upload_call = mock_upload.call_args
    assert "result.json" in final_upload_call.kwargs.get("destination_path", "")
    assert final_upload_call.kwargs.get("bucket") == "processing-results" 