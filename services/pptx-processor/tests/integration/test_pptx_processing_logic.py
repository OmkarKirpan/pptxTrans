import pytest
import os
import shutil
import uuid
from unittest.mock import patch, MagicMock

from app.services.pptx_processor import process_pptx
from app.core.config import Settings

# Define test constants
TEST_FILE_PATH = "UnderstandRatios.pptx"


# The settings fixture is now in conftest.py and named test_settings
# We can use pytest's built-in tmp_path fixture for temporary directories.

@patch("app.services.pptx_processor.get_cache_service")
@patch("app.services.pptx_processor.upload_file_to_supabase")
@patch("app.services.pptx_processor.update_local_job_status")
@patch("app.services.pptx_processor.update_supabase_job_status")
async def test_svg_generation_and_text_extraction(
    mock_update_supabase_status,
    mock_update_local_status,
    mock_upload,
    mock_cache_service,
    test_settings: Settings, # Use the session-scoped settings
    tmp_path # pytest's built-in fixture for temporary directories
):
    """
    Tests the core logic for SVG generation and text extraction from UnderstandRatios.pptx.
    This is an integration test that requires LibreOffice to be installed.
    """
    if not os.path.exists(TEST_FILE_PATH):
        pytest.fail(f"Test file '{TEST_FILE_PATH}' not found in the project root.")

    # --- Test Setup ---
    job_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    # Create a unique directory for this test run to mimic the production environment
    # where each upload gets its own folder.
    test_upload_dir = tmp_path / job_id
    test_upload_dir.mkdir()
    
    # Copy the test presentation to the temporary directory
    temp_pptx_path = test_upload_dir / os.path.basename(TEST_FILE_PATH)
    shutil.copy(TEST_FILE_PATH, temp_pptx_path)

    # Configure the upload mock to return a proper URL string
    mock_upload.return_value = "https://fake-supabase.com/storage/test-bucket/test-file.json"
    
    # Mock the cache service to disable caching during tests
    mock_cache = MagicMock()
    mock_cache.generate_cache_key.return_value = None  # Disable caching by returning None
    mock_cache.get_cached_result.return_value = None
    mock_cache_service.return_value = mock_cache
    
    # The `process_pptx` function is the main orchestrator for the logic we want to test.
    # We mock the Supabase/job status parts to test the file processing in isolation.
    await process_pptx(
        job_id=job_id,
        session_id=session_id,
        file_path=str(temp_pptx_path), # Use the path to the temp file
        source_language="en",
        target_language="es",
        generate_thumbnails=True,
    )

    # --- Assertions ---
    # The `process_pptx` function cleans up its own output directory.
    # We verify the outcome through the mock calls.
    expected_svg_count = 56  # Updated to match actual slide count in UnderstandRatios.pptx

    # Verify that the final status update was called, implying success
    mock_update_supabase_status.assert_called_once()
    
    # Inspect the data that was passed to the final status update
    final_status_kwargs = mock_update_supabase_status.call_args.kwargs
    
    assert final_status_kwargs.get("status") == "completed"
    assert final_status_kwargs.get("slide_count") == expected_svg_count
    assert "result_url" in final_status_kwargs

    # We can also check that the local status was updated multiple times
    assert mock_update_local_status.call_count > 1

    # Verify the upload was called the expected number of times
    # 56 slides * 2 (SVG + thumbnail) + 1 result file = 113 total uploads
    expected_upload_count = expected_svg_count * 2 + 1  # SVGs + thumbnails + result file
    assert mock_upload.call_count == expected_upload_count
    
    # Verify the final upload call was for the result file
    final_upload_call = mock_upload.call_args
    assert final_upload_call.kwargs.get("bucket") == "processing-results"
    assert "result.json" in final_upload_call.kwargs.get("destination_path", "") 