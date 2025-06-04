import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import get_settings, Settings
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def test_settings():
    """Mock application settings for testing."""
    return Settings(
        API_ENV="test",
        TEMP_UPLOAD_DIR="./tmp/test_uploads",
        TEMP_PROCESSING_DIR="./tmp/test_processing",
        SUPABASE_URL="http://fake-supabase-url.com",
        SUPABASE_KEY="fake-supabase-key",
        SUPABASE_STORAGE_BUCKET="test-bucket",
        PROJECT_VERSION="1.0.0-test",
        LIBREOFFICE_PATH=None,  # No LibreOffice for tests
    )


@pytest.fixture
def mock_settings(test_settings):
    """Patch the get_settings function to return test settings."""
    with patch("app.core.config.get_settings", return_value=test_settings):
        yield test_settings


@pytest.fixture
def test_client(mock_settings):
    """Create a FastAPI TestClient with mocked settings."""
    with TestClient(app) as client:
        yield client


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    mock_client = MagicMock()

    # Mock storage
    mock_client.storage = MagicMock()
    mock_client.storage.list_buckets = MagicMock(
        return_value=[{"name": "test-bucket"}])
    mock_client.storage.from_ = MagicMock()
    mock_client.storage.from_().upload = MagicMock(
        return_value={"Key": "test-file.svg"})
    mock_client.storage.from_().get_public_url = MagicMock(
        return_value="https://fake-supabase.com/storage/test-bucket/test-file.svg")

    # Mock database
    mock_client.table = MagicMock()
    mock_client.table().insert = MagicMock()
    mock_client.table().insert().execute = MagicMock(
        return_value=MagicMock(data=[{"id": "test-id"}]))
    mock_client.table().update = MagicMock()
    mock_client.table().update().eq = MagicMock()
    mock_client.table().update().eq().execute = MagicMock()

    return mock_client


@pytest.fixture
def mock_supabase_service(mock_supabase_client):
    """Patch the Supabase service functions."""
    with patch("app.services.supabase_service._create_supabase_client", return_value=mock_supabase_client), \
            patch("app.services.supabase_service.check_supabase_connection", return_value=True), \
            patch("app.services.supabase_service.validate_supabase_credentials", return_value=True):
        yield


@pytest.fixture
def event_loop():
    """Create an instance of the default event loop for each test."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
