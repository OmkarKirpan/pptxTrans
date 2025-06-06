from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, AnyUrl, field_validator
from datetime import datetime
import uuid


class ShapeType(str, Enum):
    """Type of shape in a slide."""
    TEXT = "text"
    IMAGE = "image"
    TABLE_CELL = "table_cell"
    CHART_TEXT = "chart_text"
    SMARTART_TEXT = "smartart_text"


class CoordinateUnit(str, Enum):
    """Unit for shape coordinates."""
    PERCENTAGE = "percentage"
    PIXELS = "px"
    EMU = "emu"


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
    original_text: Optional[str] = Field(None,
                                         description="Original text content of the shape (if any)")
    x_coordinate: float = Field(..., description="X coordinate of the shape")
    y_coordinate: float = Field(..., description="Y coordinate of the shape")
    width: float = Field(..., description="Width of the shape")
    height: float = Field(..., description="Height of the shape")
    coordinates_unit: CoordinateUnit = Field(CoordinateUnit.EMU,
                                             description="Unit of the coordinates")
    font_size: Optional[float] = Field(
        None, description="Font size of the text in points")
    font_family: Optional[str] = Field(
        None, description="Font family of the text")
    font_weight: Optional[str] = Field(
        None, description="Font weight of the text (normal, bold)")
    font_style: Optional[str] = Field(
        None, description="Font style of the text (normal, italic)")
    color: Optional[str] = Field(
        None, description="Color of the text in hex format (e.g., #RRGGBB)")
    text_align: Optional[str] = Field(
        None, description="Horizontal alignment of the text (e.g., LEFT, CENTER, RIGHT, JUSTIFY)")
    vertical_anchor: Optional[str] = Field(
        None, description="Vertical alignment of the text (e.g., TOP, MIDDLE, BOTTOM)")
    line_spacing: Optional[float] = Field(
        None, description="Line spacing of the text (e.g., 1.0 for single, 1.5 for 1.5 lines)")
    image_content_type: Optional[str] = Field(
        None, description="MIME type of the image (e.g., image/png, image/jpeg)")
    image_base64: Optional[str] = Field(
        None, description="Base64 encoded string of the image data")
    reading_order: Optional[int] = Field(
        None, description="Reading order of the text element (1-based)")
    parent_id: Optional[str] = Field(
        None, description="ID of the parent shape (for grouped elements)")
    
    # Translation-optimized metadata fields
    is_title: Optional[bool] = Field(
        False, description="Whether this shape is identified as a title")
    is_subtitle: Optional[bool] = Field(
        False, description="Whether this shape is identified as a subtitle")
    text_length: Optional[int] = Field(
        None, description="Length of the text content in characters")
    word_count: Optional[int] = Field(
        None, description="Number of words in the text content")
    translation_priority: Optional[int] = Field(
        None, ge=1, le=10, description="Translation priority (1-10, higher is more important)")
    placeholder_type: Optional[str] = Field(
        None, description="PowerPoint placeholder type (e.g., TITLE, SUBTITLE, BODY)")
    
    # Coordinate validation metadata fields
    coordinate_validation_score: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Confidence score for coordinate validation (0.0-1.0)")
    svg_matched: Optional[bool] = Field(
        None, description="Whether this shape was successfully matched with SVG text element")
    svg_original_x: Optional[float] = Field(
        None, description="Original X coordinate from SVG before transformation")
    svg_original_y: Optional[float] = Field(
        None, description="Original Y coordinate from SVG before transformation")
    coordinate_source: Optional[str] = Field(
        None, description="Source of coordinates (pptx_extraction, svg_validation, manual_adjustment)")
    
    # Text segmentation metadata for translation
    text_segments: Optional[List[Dict[str, Any]]] = Field(
        None, description="Segmented text units for translation workflow")
    segment_count: Optional[int] = Field(
        None, description="Number of text segments")
    is_segmented: Optional[bool] = Field(
        None, description="Whether the text has been segmented for translation")
    validation_status: Optional[str] = Field(None, description="Status of coordinate validation")
    validation_details: Optional[str] = Field(None, description="Detailed validation information")
    
    # Alias for backward compatibility - 'text' points to 'original_text'
    @property
    def text(self) -> Optional[str]:
        """Alias for original_text for backward compatibility."""
        return self.original_text
    
    @text.setter
    def text(self, value: Optional[str]) -> None:
        """Setter for text property."""
        self.original_text = value

    @field_validator("shape_id", mode="before")
    @classmethod
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

    @field_validator("slide_id", mode="before")
    @classmethod
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

# New Models for Metrics Endpoint

class WorkerPoolMetrics(BaseModel):
    max_workers: int
    current_busy_slots: int
    available_slots: int
    total_tasks_acquired: int
    total_tasks_released: int

class ProcessingManagerMetrics(BaseModel):
    jobs_submitted: int
    jobs_succeeded: int
    jobs_failed: int
    current_queue_size: int
    is_running: bool
    worker_pool_metrics: WorkerPoolMetrics

class ServiceMetricsResponse(BaseModel):
    """Response model for the service metrics endpoint."""
    service_name: str = Field(default="PPTX Processor Service")
    version: str
    uptime_seconds: float
    processing_manager: ProcessingManagerMetrics
    # Potentially add other system metrics later (CPU, memory, etc.)

# Export-related models
class ExportResponse(BaseModel):
    """Response after starting an export job."""
    job_id: str = Field(..., description="Unique identifier for the export job")
    session_id: str = Field(..., description="Unique identifier for the translation session")
    status: ProcessingStatus = Field(..., description="Current status of the export job")
    created_at: Optional[datetime] = Field(default_factory=datetime.now, description="Time when the export job was created")
    message: Optional[str] = Field(None, description="Informational message")

class DownloadUrlResponse(BaseModel):
    """Response containing a download URL for an exported file."""
    download_url: str = Field(..., description="URL to download the exported file")
    expires_at: datetime = Field(..., description="Time when the download URL expires")
