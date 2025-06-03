import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


def test_health_endpoint_success(test_client, mock_supabase_service):
    """Test that the health endpoint returns 200 OK when all systems are healthy."""
    # Mock psutil for system info
    with patch("psutil.cpu_percent", return_value=10.0), \
            patch("psutil.virtual_memory", return_value=MagicMock(percent=50.0)), \
            patch("psutil.disk_usage", return_value=MagicMock(percent=30.0)):

        response = test_client.get("/health/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

        # Check components
        assert data["components"]["system"]["status"] == "healthy"
        assert data["components"]["supabase"]["status"] == "healthy"
        assert data["components"]["storage"]["status"] == "healthy"

        # Check metrics format
        assert "CPU:" in data["components"]["system"]["message"]
        assert "Memory:" in data["components"]["system"]["message"]
        assert "Disk:" in data["components"]["system"]["message"]


def test_health_endpoint_supabase_failure(test_client):
    """Test that the health endpoint returns 500 when Supabase is unhealthy."""
    # Mock psutil and supabase connection check (failed)
    with patch("psutil.cpu_percent", return_value=10.0), \
            patch("psutil.virtual_memory", return_value=MagicMock(percent=50.0)), \
            patch("psutil.disk_usage", return_value=MagicMock(percent=30.0)), \
            patch("app.services.supabase_service.check_supabase_connection", return_value=False):

        response = test_client.get("/health/health")

        assert response.status_code == 500
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["components"]["supabase"]["status"] == "unhealthy"
        assert data["components"]["system"]["status"] == "healthy"
        assert data["components"]["storage"]["status"] == "healthy"


def test_health_endpoint_storage_failure(test_client, mock_supabase_service):
    """Test that the health endpoint returns 500 when storage is unhealthy."""
    # Mock psutil and os.access for storage (failed)
    with patch("psutil.cpu_percent", return_value=10.0), \
            patch("psutil.virtual_memory", return_value=MagicMock(percent=50.0)), \
            patch("psutil.disk_usage", return_value=MagicMock(percent=30.0)), \
            patch("os.access", return_value=False):

        response = test_client.get("/health/health")

        assert response.status_code == 500
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["components"]["storage"]["status"] == "unhealthy"
        assert data["components"]["system"]["status"] == "healthy"
        assert data["components"]["supabase"]["status"] == "healthy"
