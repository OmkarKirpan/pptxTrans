from fastapi import APIRouter, HTTPException
import time

from app.services.processing_manager import get_processing_manager, ProcessingManager # For type hint
from app.models.schemas import ServiceMetricsResponse, ProcessingManagerMetrics, WorkerPoolMetrics
from app.core.config import get_settings

router = APIRouter()

# Store application start time. This should ideally be set once when the app truly starts.
# For a module-level variable, this will be set when the module is first imported.
APP_START_TIME = time.time()

@router.get("/metrics", response_model=ServiceMetricsResponse, tags=["metrics"])
async def get_service_metrics():
    """
    Provides service metrics including processing manager status and worker pool details.
    """
    try:
        manager = get_processing_manager()
        settings = get_settings()
    except RuntimeError as e:
        # This can happen if the manager hasn't been initialized (e.g., startup error)
        raise HTTPException(status_code=503, detail=f"Service not fully initialized: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving metrics: {str(e)}")

    uptime_seconds = time.time() - APP_START_TIME
    manager_metrics_dict = manager.get_metrics()
    worker_pool_metrics_dict = manager_metrics_dict.pop("worker_pool_metrics") # Extract for nested model

    # Construct Pydantic models for response validation and serialization
    worker_pool_pydantic = WorkerPoolMetrics(**worker_pool_metrics_dict)
    manager_pydantic = ProcessingManagerMetrics(
        **manager_metrics_dict, # The rest of the manager metrics
        worker_pool_metrics=worker_pool_pydantic
    )
    
    return ServiceMetricsResponse(
        version=settings.PROJECT_VERSION,
        uptime_seconds=uptime_seconds,
        processing_manager=manager_pydantic
    ) 