import pytest
import os
from unittest.mock import patch, MagicMock
from app.services.supabase_service import (
    _normalize_supabase_url,
    _create_supabase_client,
    check_supabase_connection,
    validate_supabase_credentials,
    upload_file_to_supabase
)


def test_normalize_supabase_url():
    """Test the URL normalization function."""
    # Test with no scheme
    assert _normalize_supabase_url("example.com") == "http://example.com"

    # Test with scheme
    assert _normalize_supabase_url(
        "https://example.com") == "https://example.com"

    # Test with trailing slash
    assert _normalize_supabase_url(
        "https://example.com/") == "https://example.com"

    # Test with path
    assert _normalize_supabase_url(
        "https://example.com/api/") == "https://example.com/api"

    # Test with empty URL
    assert _normalize_supabase_url("") == ""


@pytest.mark.asyncio
async def test_check_supabase_connection_success(mock_supabase_client):
    """Test successful Supabase connection check."""
    # Mock the storage.list_buckets() method to return a successful response
    mock_supabase_client.storage.list_buckets.return_value = [{"name": "test-bucket"}]
    
    # Patch the create_client function from supabase library, not _create_supabase_client
    with patch("app.services.supabase_service.create_client", return_value=mock_supabase_client):
        result = await check_supabase_connection()
        assert result is True


@pytest.mark.asyncio
async def test_check_supabase_connection_failure():
    """Test failed Supabase connection check."""
    with patch("app.services.supabase_service._create_supabase_client", side_effect=Exception("Connection error")):
        result = await check_supabase_connection()
        assert result is False


@pytest.mark.asyncio
async def test_validate_supabase_credentials_success(mock_supabase_client):
    """Test successful Supabase credentials validation."""
    with patch("app.services.supabase_service._create_supabase_client", return_value=mock_supabase_client), \
            patch("app.services.supabase_service.create_client", return_value=mock_supabase_client):
        result = await validate_supabase_credentials("http://example.com", "fake-key")
        assert result is True


@pytest.mark.asyncio
async def test_validate_supabase_credentials_failure():
    """Test failed Supabase credentials validation."""
    with patch("app.services.supabase_service.create_client", side_effect=Exception("Invalid credentials")):
        with pytest.raises(Exception) as excinfo:
            await validate_supabase_credentials("http://example.com", "fake-key")
        assert "Invalid Supabase credentials" in str(excinfo.value)


@pytest.mark.asyncio
async def test_upload_file_to_supabase(mock_supabase_client, tmp_path):
    """Test uploading a file to Supabase storage."""
    # Create a test file
    test_file = tmp_path / "test.txt"
    test_file.write_text("test content")

    # Mock the supabase client
    with patch("app.services.supabase_service._create_supabase_client", return_value=mock_supabase_client):
        url = await upload_file_to_supabase(
            file_path=str(test_file),
            bucket="test-bucket",
            destination_path="test/test.txt"
        )

        # Verify the URL is returned
        assert url == "https://fake-supabase.com/storage/test-bucket/test-file.svg"

        # Verify that the client was called correctly (multiple calls expected for upload operations)
        assert mock_supabase_client.storage.from_.call_count >= 1
        # Check that at least one call was made with the correct bucket
        mock_supabase_client.storage.from_.assert_any_call("test-bucket")


def test_create_supabase_client_cleans_input():
    """Test that create_supabase_client properly cleans inputs."""
    with patch("app.services.supabase_service.create_client", return_value=MagicMock()) as mock_create:
        # Test with comments and quotes
        _create_supabase_client(
            supabase_url='"http://example.com" # comment',
            supabase_key='"fake-key" # comment'
        )

        # Check that create_client was called with cleaned values
        mock_create.assert_called_once()
        args, _ = mock_create.call_args
        assert args[0] == "http://example.com"  # URL is cleaned
        assert args[1] == "fake-key"  # Key is cleaned
