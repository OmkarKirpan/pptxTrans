from functools import lru_cache
from typing import List
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Project info
    PROJECT_NAME: str = "PPTX Processor Microservice"
    PROJECT_DESCRIPTION: str = "Service for converting PowerPoint presentations to SVGs and extracting text data"
    PROJECT_VERSION: str = "1.0.0"

    # API Settings
    ENVIRONMENT: str = os.getenv("API_ENV", "development")
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # CORS
    ALLOWED_ORIGINS: List[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000").split(",")

    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))

    # Celery
    CELERY_BROKER_URL: str = os.getenv(
        "CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    # Storage
    TEMP_UPLOAD_DIR: str = os.getenv(
        "TEMP_UPLOAD_DIR", "/tmp/pptx-processor/uploads")
    TEMP_PROCESSING_DIR: str = os.getenv(
        "TEMP_PROCESSING_DIR", "/tmp/pptx-processor/processing")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_STORAGE_BUCKET: str = os.getenv(
        "SUPABASE_STORAGE_BUCKET", "slide_visuals")

    # Processing settings
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50 MB
    SUPPORTED_FILE_TYPES: List[str] = [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
    SVG_QUALITY: int = 90  # Quality for SVG conversion (0-100)
    GENERATE_THUMBNAILS: bool = True
    THUMBNAIL_WIDTH: int = 250  # Width in pixels

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
