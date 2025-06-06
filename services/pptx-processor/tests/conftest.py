import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import get_settings, Settings
from fastapi.testclient import TestClient
from app.main import create_application
import os

@pytest.fixture(scope="session")
def test_settings():
    """Override settings for the entire test session."""
    return Settings(
        API_ENV="test",
        TEMP_UPLOAD_DIR="./tmp/test_uploads",
        TEMP_PROCESSING_DIR="./tmp/test_processing",
        SUPABASE_URL="http://fake-supabase-url.com",
        SUPABASE_KEY="fake-supabase-key",
        SUPABASE_STORAGE_BUCKET="test-bucket",
        PROJECT_VERSION="1.0.0-test",
        LIBREOFFICE_PATH=None,  # No LibreOffice for tests
        ENVIRONMENT="test",
    )

@pytest.fixture(scope="session")
def app(test_settings):
    """Create a FastAPI app instance for the test session with overridden settings."""
    def get_settings_override():
        return test_settings

    application = create_application()
    application.dependency_overrides[get_settings] = get_settings_override
    
    upload_dir = test_settings.TEMP_UPLOAD_DIR
    processing_dir = test_settings.TEMP_PROCESSING_DIR
    
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(processing_dir, exist_ok=True)

    yield application

    application.dependency_overrides.clear()


@pytest.fixture(scope="module")
def test_client(app):
    """
    Provides a TestClient that can be used across a test module.
    The client is configured with test settings and a mocked processing manager
    to prevent the real one from starting during tests.
    """
    with patch("app.main.initialize_processing_manager"), \
         patch("app.main.get_processing_manager", return_value=AsyncMock()):
        with TestClient(app) as client:
            yield client


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    mock_client = MagicMock()

    mock_client.storage = MagicMock()
    mock_client.storage.list_buckets = MagicMock(
        return_value=[{"name": "test-bucket"}])
    
    mock_bucket = MagicMock()
    mock_bucket.upload = MagicMock(return_value={"Key": "test-file.svg"})
    mock_bucket.remove = MagicMock(return_value=True)
    mock_bucket.get_public_url = MagicMock(
        return_value="https://fake-supabase.com/storage/test-bucket/test-file.svg")
    
    mock_client.storage.from_ = MagicMock(return_value=mock_bucket)

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
    """
    Patches Supabase service functions for tests that need to simulate
    a healthy Supabase connection without making real calls.
    """
    async def mock_check_connection(*args, **kwargs):
        return True

    # Use new_callable to properly patch async functions that are awaited in routes
    with patch("app.services.supabase_service._create_supabase_client", return_value=mock_supabase_client), \
         patch("app.api.routes.health.check_supabase_connection", new_callable=lambda: mock_check_connection), \
         patch("app.services.supabase_service.check_supabase_connection", new_callable=lambda: mock_check_connection):
        yield 