from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.api.routes import processing, status, health
from app.core.config import Settings, get_settings

# Load environment variables
load_dotenv()


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

    return application


app = create_application()


@app.on_event("startup")
async def startup_event():
    """Initialize application resources on startup."""
    # Create temp directories if they don't exist
    settings = get_settings()
    os.makedirs(settings.TEMP_UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.TEMP_PROCESSING_DIR, exist_ok=True)


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    # Any cleanup logic here
    pass


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.ENVIRONMENT != "production",
    )
