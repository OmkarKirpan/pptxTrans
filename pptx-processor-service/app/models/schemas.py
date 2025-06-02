from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, AnyUrl, validator
from datetime import datetime
import uuid


class ShapeType(str, Enum):
    """Type of shape in a slide."""
    TEXT = "text"
    TABLE_CELL = "table_cell"
    CHART_TEXT = "chart_text"
    SMARTART_TEXT = "smartart_text"


class CoordinateUnit(str, Enum):
    """Unit for shape coordinates."""
    PERCENTAGE = "percentage"
    PIXELS = "px"


class ProcessingStatus(str, Enum):
    """Status of a processing job."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OverallProcessingStatus(str, Enum):
    """Overall status of presentation processing."""
    COMPLETED = "completed"
    PARTIALLY_COMPLETED = "partially_completed"
    FAILED = "failed"


class HealthStatus(str, Enum):
    """Health status of the service."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class SlideShape(BaseModel):
    """A text shape on a slide."""
    shape_id: str = Field(..., description="Unique identifier for the shape")
    shape_type: ShapeType = Field(..., description="Type of the shape")
    original_text: str = Field(...,
                               description="Original text content of the shape")
    x_coordinate: float = Field(..., description="X coordinate of the shape")
    y_coordinate: float = Field(..., description="Y coordinate of the shape")
    width: float = Field(..., description="Width of the shape")
    height: float = Field(..., description="Height of the shape")
    coordinates_unit: CoordinateUnit = Field(...,
                                             description="Unit of the coordinates")
    font_size: Optional[float] = Field(
        None, description="Font size of the text")
    font_family: Optional[str] = Field(
        None, description="Font family of the text")
    font_weight: Optional[str] = Field(
        None, description="Font weight of the text (normal, bold)")
    font_style: Optional[str] = Field(
        None, description="Font style of the text (normal, italic)")
    color: Optional[str] = Field(
        None, description="Color of the text in hex format")
    reading_order: Optional[int] = Field(
        None, description="Reading order of the text element (1-based)")
    parent_id: Optional[str] = Field(
        None, description="ID of the parent shape (for grouped elements)")

    @validator("shape_id", pre=True, always=True)
    def set_shape_id(cls, v):
        """Set a UUID for shape_id if not provided."""
        return v or str(uuid.uuid4())


class ProcessedSlide(BaseModel):
    """A processed slide with its SVG and text shapes."""
    slide_id: str = Field(..., description="Unique identifier for the slide")
    slide_number: int = Field(...,
                              description="Slide number in the presentation (1-based)")
    svg_url: AnyUrl = Field(...,
                            description="URL to the SVG representation of the slide")
    original_width: int = Field(...,
                                description="Original width of the slide in pixels")
    original_height: int = Field(...,
                                 description="Original height of the slide in pixels")
    thumbnail_url: Optional[AnyUrl] = Field(
        None, description="URL to a thumbnail image of the slide")
    shapes: List[SlideShape] = Field(
        default_factory=list, description="Text shapes on the slide")

    @validator("slide_id", pre=True, always=True)
    def set_slide_id(cls, v):
        """Set a UUID for slide_id if not provided."""
        return v or str(uuid.uuid4())


class ProcessedPresentation(BaseModel):
    """A processed presentation with all its slides."""
    session_id: str = Field(...,
                            description="Unique identifier for the translation session")
    slide_count: int = Field(...,
                             description="Total number of slides in the presentation")
    processing_status: OverallProcessingStatus = Field(
        ..., description="Overall status of the processing")
    processing_time: Optional[int] = Field(
        None, description="Processing time in seconds")
    slides: List[ProcessedSlide] = Field(
        default_factory=list, description="Processed slides")


class ProcessingResponse(BaseModel):
    """Response after starting a processing job."""
    job_id: str = Field(...,
                        description="Unique identifier for the processing job")
    session_id: str = Field(...,
                            description="Unique identifier for the translation session")
    status: ProcessingStatus = Field(...,
                                     description="Current status of the processing job")
    message: str = Field(..., description="Informational message")
    estimated_completion_time: Optional[datetime] = Field(
        None, description="Estimated time of completion")


class BatchProcessingJob(BaseModel):
    """Information about a job in a batch."""
    job_id: str = Field(...,
                        description="Unique identifier for the processing job")
    session_id: str = Field(...,
                            description="Unique identifier for the translation session")
    status: ProcessingStatus = Field(...,
                                     description="Current status of the processing job")


class BatchProcessingResponse(BaseModel):
    """Response after starting a batch processing job."""
    batch_id: str = Field(..., description="Unique identifier for the batch")
    jobs: List[BatchProcessingJob] = Field(...,
                                           description="List of jobs in the batch")


class ProcessingStatusResponse(BaseModel):
    """Status of a processing job."""
    job_id: str = Field(...,
                        description="Unique identifier for the processing job")
    session_id: str = Field(...,
                            description="Unique identifier for the translation session")
    status: ProcessingStatus = Field(...,
                                     description="Current status of the processing job")
    progress: int = Field(..., ge=0, le=100,
                          description="Progress percentage of the processing job")
    current_stage: Optional[str] = Field(
        None, description="Current processing stage")
    message: Optional[str] = Field(
        None, description="Informational or error message")
    completed_at: Optional[datetime] = Field(
        None, description="Time when processing completed")
    error: Optional[str] = Field(
        None, description="Error details (if status is failed)")


class ComponentHealth(BaseModel):
    """Health status of a system component."""
    status: HealthStatus = Field(...,
                                 description="Health status of the component")
    message: Optional[str] = Field(
        None, description="Additional information about the component health")


class HealthCheckResponse(BaseModel):
    """Response from a health check."""
    status: HealthStatus = Field(...,
                                 description="Overall health status of the service")
    version: str = Field(..., description="Version of the service")
    uptime: Optional[float] = Field(
        None, description="Service uptime in seconds")
    components: Optional[Dict[str, ComponentHealth]] = Field(
        None, description="Health status of individual components")


class ErrorResponse(BaseModel):
    """Standard error response."""
    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Additional error details")
