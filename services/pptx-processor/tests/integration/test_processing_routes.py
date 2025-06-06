import pytest
from fastapi.testclient import TestClient
import os
import uuid
from unittest.mock import patch
import io

# from app.main import app # No longer needed

# Define test constants
TEST_FILE_PATH = "UnderstandRatios.pptx"
SUPPORTED_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


# The client fixture is now in conftest.py
# @pytest.fixture(scope="module")
# def client():
#     """Create a TestClient instance for the FastAPI app."""
#     with TestClient(app) as c:
#         yield c


@patch("app.api.routes.processing.validate_supabase_credentials", return_value=None)
@patch("app.api.routes.processing.queue_pptx_processing")
def test_process_pptx_success(mock_queue_task, mock_validate_creds, test_client):
    """
    Test successful processing of a valid PPTX file.
    """
    if not os.path.exists(TEST_FILE_PATH):
        pytest.fail(f"Test file '{TEST_FILE_PATH}' not found in the project root.")

    session_id = str(uuid.uuid4())
    with open(TEST_FILE_PATH, "rb") as f:
        files = {"file": (os.path.basename(TEST_FILE_PATH), f, SUPPORTED_CONTENT_TYPE)}
        data = {"session_id": session_id}

        response = test_client.post("/v1/process", files=files, data=data)

    assert response.status_code == 202
    response_data = response.json()
    assert response_data["session_id"] == session_id
    assert response_data["status"] == "queued"
    assert "job_id" in response_data

    # Verify that the background task was called once
    mock_queue_task.assert_called_once()
    # Verify Supabase validation was called
    mock_validate_creds.assert_called_once()


@patch("app.api.routes.processing.validate_supabase_credentials", return_value=None)
def test_process_pptx_unsupported_file_type(mock_validate_creds, test_client):
    """
    Test processing with an unsupported file type.
    """
    session_id = str(uuid.uuid4())

    # Use an in-memory file-like object instead of a physical file
    dummy_file = io.BytesIO(b"dummy content")
    files = {"file": ("test.txt", dummy_file, "text/plain")}
    data = {"session_id": session_id}

    response = test_client.post("/v1/process", files=files, data=data)

    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_process_pptx_missing_session_id(test_client):
    """
    Test request without a session_id.
    """
    if not os.path.exists(TEST_FILE_PATH):
        pytest.fail(f"Test file '{TEST_FILE_PATH}' not found in the project root.")

    with open(TEST_FILE_PATH, "rb") as f:
        files = {"file": (os.path.basename(TEST_FILE_PATH), f, SUPPORTED_CONTENT_TYPE)}
        # Missing 'session_id' in data

        response = test_client.post("/v1/process", files=files)

    assert response.status_code == 422  # Unprocessable Entity
    response_data = response.json()
    assert "Field required" in str(response_data["detail"]) 