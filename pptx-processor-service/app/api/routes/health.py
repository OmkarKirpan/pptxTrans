from fastapi import APIRouter, Depends
import time
import platform
import psutil
import os
import logging
from app.models.schemas import HealthCheckResponse, HealthStatus, ComponentHealth
from app.core.config import get_settings
from app.services.supabase_service import check_supabase_connection, validate_supabase_credentials
from fastapi.responses import JSONResponse
from fastapi import status

# Track application start time
START_TIME = time.time()

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Get health check information.
    """
    try:
        start_time = time.time()
        psutil_available = False

        # Get settings
        settings = get_settings()

        try:
            import psutil
            psutil_available = True
        except ImportError:
            pass

        system_info = {}
        if psutil_available:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory_percent = psutil.virtual_memory().percent
            disk_percent = psutil.disk_usage('/').percent
            system_info = {
                "status": "healthy",
                "message": f"CPU: {cpu_percent}%, Memory: {memory_percent}%, Disk: {disk_percent}%"
            }
        else:
            system_info = {
                "status": "healthy",
                "message": "System monitoring disabled (psutil not installed)"
            }

        # Check Supabase connection
        supabase_healthy = False
        supabase_message = "Failed to connect to Supabase"
        supabase_error = None

        try:
            supabase_healthy = await check_supabase_connection()
            if supabase_healthy:
                supabase_message = "Connected to Supabase"
            else:
                # Try to get more specific error
                try:
                    await validate_supabase_credentials(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                except Exception as e:
                    supabase_error = str(e)
        except Exception as e:
            logging.error(
                f"Supabase connection error: {str(e)}", exc_info=True)
            supabase_error = str(e)
            supabase_message = f"Error checking Supabase connection: {str(e)}"

        # Check storage
        storage_healthy = True
        storage_message = "Storage directories accessible"
        try:
            for dir_path in [settings.TEMP_UPLOAD_DIR, settings.TEMP_PROCESSING_DIR]:
                os.makedirs(dir_path, exist_ok=True)
                if not os.path.exists(dir_path) or not os.access(dir_path, os.W_OK):
                    storage_healthy = False
                    storage_message = f"Cannot access directory: {dir_path}"
                    break
        except Exception as e:
            logging.error(f"Storage error: {str(e)}", exc_info=True)
            storage_healthy = False
            storage_message = f"Storage error: {str(e)}"

        response = {
            "status": "healthy" if (supabase_healthy and storage_healthy) else "unhealthy",
            "version": settings.PROJECT_VERSION,
            "uptime": time.time() - start_time,
            "components": {
                "system": system_info,
                "supabase": {
                    "status": "healthy" if supabase_healthy else "unhealthy",
                    "message": supabase_message,
                    "error": supabase_error
                },
                "storage": {
                    "status": "healthy" if storage_healthy else "unhealthy",
                    "message": storage_message
                }
            }
        }

        if not supabase_healthy or not storage_healthy:
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response)
        return response
    except Exception as e:
        import logging
        logging.error(f"Health check error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Health check error: {str(e)}"}
        )
