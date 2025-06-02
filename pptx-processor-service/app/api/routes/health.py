from fastapi import APIRouter, Depends
import time
import platform
import psutil
import os
from app.models.schemas import HealthCheckResponse, HealthStatus, ComponentHealth
from app.core.config import Settings, get_settings
from app.services.supabase_service import check_supabase_connection

# Track application start time
START_TIME = time.time()

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(settings: Settings = Depends(get_settings)):
    """
    Check the health status of the service and its components.
    """
    # Calculate uptime
    uptime = time.time() - START_TIME

    # Check system resources
    memory_usage = psutil.virtual_memory().percent
    cpu_usage = psutil.cpu_percent(interval=0.1)
    disk_usage = psutil.disk_usage(os.path.abspath(os.sep)).percent

    # Check Supabase connection
    supabase_status = HealthStatus.HEALTHY
    supabase_message = "Connected to Supabase"

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            supabase_health = await check_supabase_connection(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            if not supabase_health:
                supabase_status = HealthStatus.UNHEALTHY
                supabase_message = "Failed to connect to Supabase"
        except Exception as e:
            supabase_status = HealthStatus.UNHEALTHY
            supabase_message = f"Error connecting to Supabase: {str(e)}"
    else:
        supabase_status = HealthStatus.DEGRADED
        supabase_message = "Supabase credentials not configured"

    # Check if temp directories exist and are writable
    storage_status = HealthStatus.HEALTHY
    storage_message = "Storage directories accessible"

    try:
        for directory in [settings.TEMP_UPLOAD_DIR, settings.TEMP_PROCESSING_DIR]:
            os.makedirs(directory, exist_ok=True)
            test_file = os.path.join(directory, ".test_write")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
    except Exception as e:
        storage_status = HealthStatus.UNHEALTHY
        storage_message = f"Storage error: {str(e)}"

    # Determine overall health status
    overall_status = HealthStatus.HEALTHY

    if supabase_status == HealthStatus.UNHEALTHY or storage_status == HealthStatus.UNHEALTHY:
        overall_status = HealthStatus.UNHEALTHY
    elif supabase_status == HealthStatus.DEGRADED or storage_status == HealthStatus.DEGRADED:
        overall_status = HealthStatus.DEGRADED

    # Return health check response
    return HealthCheckResponse(
        status=overall_status,
        version=settings.PROJECT_VERSION,
        uptime=uptime,
        components={
            "system": ComponentHealth(
                status=HealthStatus.HEALTHY if cpu_usage < 90 and memory_usage < 90 and disk_usage < 90 else HealthStatus.DEGRADED,
                message=f"CPU: {cpu_usage}%, Memory: {memory_usage}%, Disk: {disk_usage}%"
            ),
            "supabase": ComponentHealth(
                status=supabase_status,
                message=supabase_message
            ),
            "storage": ComponentHealth(
                status=storage_status,
                message=storage_message
            )
        }
    )
