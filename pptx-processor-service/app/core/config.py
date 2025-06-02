from functools import lru_cache
from typing import List, Optional
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field, Field


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra='ignore'
    )

    # Project info
    PROJECT_NAME: str = "PPTX Processor Microservice"
    PROJECT_DESCRIPTION: str = "Service for converting PowerPoint presentations to SVGs and extracting text data"
    PROJECT_VERSION: str = "1.0.0"

    # API Settings
    ENVIRONMENT: str = "development"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # CORS

    @computed_field(return_type=List[str])
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """
        Returns a list of allowed origins.
        Parses the "ALLOWED_ORIGINS" environment variable (comma-separated string)
        or defaults to ["http://localhost:3000"] if the env var is not set or is empty/whitespace.
        """
        env_val: Optional[str] = os.getenv("ALLOWED_ORIGINS")

        origins_list: List[str] = []
        if env_val is not None:
            if env_val.strip():
                origins_list = [origin.strip()
                                for origin in env_val.split(',') if origin.strip()]

        if not origins_list:
            return ["http://localhost:3000"]
        return origins_list

    # Storage - Using relative paths for Windows compatibility
    TEMP_UPLOAD_DIR: str = os.path.join(".", "tmp", "uploads")
    TEMP_PROCESSING_DIR: str = os.path.join(".", "tmp", "processing")

    # Supabase - REQUIRED for the service to function
    SUPABASE_URL: str = Field(
        "", description="Supabase project URL (e.g., https://yourproject.supabase.co)")
    SUPABASE_KEY: str = Field(
        "", description="Supabase service key with permissions for storage and database")
    SUPABASE_STORAGE_BUCKET: str = Field(
        "slide-visuals", description="Supabase Storage bucket name for storing processed assets")

    # Processing settings
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50 MB
    SUPPORTED_FILE_TYPES: List[str] = [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
    SVG_QUALITY: int = 90
    GENERATE_THUMBNAILS: bool = True
    THUMBNAIL_WIDTH: int = 250

    TEMP_DIR: str = "/tmp/pptx_processor"  # Example default
    LIBREOFFICE_PATH: Optional[str] = None

    def validate_supabase_config(self) -> bool:
        """
        Validates that the required Supabase configuration is present.
        Returns True if valid, False otherwise.
        """
        if not self.SUPABASE_URL or not self.SUPABASE_KEY:
            return False

        # Basic URL validation
        if not self.SUPABASE_URL.startswith('http://') and not self.SUPABASE_URL.startswith('https://'):
            # Auto-fix URLs missing protocol by assuming http://
            self.SUPABASE_URL = 'http://' + self.SUPABASE_URL

        return True


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
