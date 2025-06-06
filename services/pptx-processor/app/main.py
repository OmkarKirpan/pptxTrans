from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import logging
from pythonjsonlogger.json import JsonFormatter

from app.api.routes import processing, status, health, metrics, export
from app.core.config import Settings, get_settings

# Imports for ProcessingManager lifecycle
from app.services.worker_pool import WorkerPool
from app.services.processing_manager import initialize_processing_manager, get_processing_manager
from app.services.pptx_processor import process_pptx # The actual function to process jobs

# Load environment variables
load_dotenv()

# Configure structured JSON logging
def setup_logging():
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logger = logging.getLogger()
    logger.setLevel(log_level)
    
    # Remove existing handlers to avoid duplicate logs
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logHandler = logging.StreamHandler()
    
    # format_str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    # More detailed format string including timestamp, level, name, message, and any extra fields passed
    format_str = '%(timestamp)s %(levelname)s %(name)s %(message)s'
    formatter = JsonFormatter(
        format_str,
        rename_fields={'asctime': 'timestamp', 'levelname': 'level', 'name': 'logger_name'},
        datefmt="%Y-%m-%dT%H:%M:%S%z" # ISO 8601 format
    )
    
    logHandler.setFormatter(formatter)
    logger.addHandler(logHandler)

# Set up logging before creating the logger instance
setup_logging()

logger = logging.getLogger(__name__)

def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.PROJECT_DESCRIPTION,
        version=settings.PROJECT_VERSION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    )

    # Configure CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    application.include_router(
        processing.router, prefix="/v1", tags=["processing"])
    application.include_router(status.router, prefix="/v1", tags=["status"])
    application.include_router(health.router, prefix="/v1", tags=["health"])
    application.include_router(metrics.router, prefix="/v1", tags=["metrics"])
    application.include_router(export.router, prefix="/v1", tags=["export"])

    return application


app = create_application()


@app.on_event("startup")
async def startup_event():
    """Initialize application resources on startup."""
    settings = get_settings()
    logger.info("Application startup sequence initiated...")

    # Create temp directories if they don't exist
    os.makedirs(settings.TEMP_UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.TEMP_PROCESSING_DIR, exist_ok=True)
    logger.info("Temporary directories ensured.")

    # Validate Supabase configuration
    if not settings.validate_supabase_config():
        logger.error(
            "CRITICAL ERROR: Supabase credentials not configured or invalid. "
            "Set SUPABASE_URL and SUPABASE_KEY in environment variables or .env file. "
            "The service will not be able to store processed assets."
        )
        # Depending on strictness, might raise an exception or prevent startup
    else:
        logger.info("Supabase configuration validated.")

    # Initialize and start the ProcessingManager
    logger.info("Initializing WorkerPool and ProcessingManager...")
    try:
        worker_pool = WorkerPool() # Uses MAX_CONCURRENT_JOBS from settings
        manager = initialize_processing_manager(worker_pool=worker_pool, process_func=process_pptx)
        manager.start()
        logger.info("ProcessingManager started successfully.")
    except Exception as e:
        logger.critical(f"Failed to initialize or start ProcessingManager: {e}", exc_info=True)
        # This is a critical failure, consider how the app should behave.
        # For now, it will log and continue, but processing might not work.

    logger.info("Application startup sequence completed.")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    logger.info("Application shutdown sequence initiated...")
    try:
        manager = get_processing_manager()
        logger.info("Stopping ProcessingManager...")
        await manager.stop(graceful=True) # Allow ongoing tasks to finish
        logger.info("ProcessingManager stopped.")
    except RuntimeError as e:
        logger.warning(f"ProcessingManager was not initialized or already stopped: {e}")
    except Exception as e:
        logger.error(f"Error during ProcessingManager shutdown: {e}", exc_info=True)
    
    # Other cleanup logic here (if any)
    logger.info("Application shutdown sequence completed.")


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    # Ensure LOG_LEVEL from settings is applied to uvicorn if running directly
    log_level_to_use = settings.LOG_LEVEL.lower()
    if log_level_to_use not in ["critical", "error", "warning", "info", "debug", "trace"]:
        log_level_to_use = "info"

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.ENVIRONMENT != "production",
        log_level=log_level_to_use
    )
