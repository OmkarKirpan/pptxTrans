# Technical Context

## Technologies Used

### Core Framework
- **FastAPI**: Modern, high-performance Python web framework for the API layer.

### Service Architecture (Updated)
The service is organized into a set of single-responsibility modules:

- **Main Orchestrator (`pptx_processor.py`)**: Coordinates the high-level processing workflow.
- **SVG Generation Module (`svg_generator.py`)**: Dedicated to creating SVGs via LibreOffice (UNO API + Batch).
- **Slide Parser Module (`slide_parser.py`)**: Handles all text/shape extraction and validation using `python-pptx`.
- **Processing Manager & Worker Pool (`processing_manager.py`, `worker_pool.py`)**: Manages a background job queue and ensures concurrent processing limits are respected.
- **Caching (`cache_service.py`)**: Implements a file-based cache to avoid reprocessing identical files.
- **Status Management (`job_status.py`, `supabase_service.py`)**: A dual-channel system for tracking real-time progress locally and persistent final status in Supabase.
- **Results Retrieval (`results_service.py`)**: Fetches final results, either from a cached JSON file in storage or by reconstructing them from the database.
- **Supabase Client (`supabase_service.py`)**: Isolates all Supabase DB and Storage interactions.

### Core Dependencies
- **`python-pptx`**: For parsing PPTX files, extracting slide content, shapes, text, styles, and metadata.

### Enhanced Dependencies
- **`fuzzywuzzy`**: For advanced text matching and coordinate validation
- **`python-json-logger`**: For structured JSON logging with contextual data
- **Supabase**: For object storage (PPTX, SVGs, thumbnails) and database integration
- **`python-dotenv`**: For managing environment variables
- **`uv`**: For Python package management (replacing pip)
- **`aiofiles`**: For asynchronous file operations

## Current Technical Implementation

### 1. Modular SVG Generation Strategy
- **Primary Strategy**: UNO API individual slide processing with retry mechanisms
  - Connects to unoserver via UNO bridge
  - Processes each slide individually for maximum control
  - Implements async retry decorator with exponential backoff
  - Handles connection failures gracefully
- **Fallback Strategy**: LibreOffice batch conversion for reliability
  - Single batch call for all slides if UNO API fails
  - Robust file mapping and timeout handling
  - Comprehensive error detection and reporting

### 2. Enhanced Text Extraction & Validation
- **Shape Extraction**: Advanced shape processing with table cell granularity
- **Coordinate Validation**: Complete SVG text matching pipeline
  - Extracts text elements from generated SVG files
  - Fuzzy text matching with confidence scoring
  - Coordinate transformation and validation
  - Validation status tracking (validated, partial, questionable, error)
- **Translation Optimization**: Metadata structured for translation workflows

### 3. Reliability Improvements
- **Async Retry Mechanisms**: Handles transient UNO API connection failures
- **Module Isolation**: Failures in one module don't cascade to others
- **Comprehensive Error Handling**: Module-specific error strategies
- **Structured Logging**: JSON logs with contextual data (job_id, session_id, etc.)

## Development Setup

### Environment Requirements
- Python 3.10+
- LibreOffice (required for SVG generation)
- unoserver (for UNO API functionality)
- Supabase account and project (for storage)

### Updated Development Steps
1. Clone repository
2. Create Python virtual environment
3. Install dependencies: `uv pip install -r requirements.txt`
4. Set up `.env` file based on `env.example`
5. Configure LibreOffice path: `LIBREOFFICE_PATH=/usr/bin/soffice`
6. Start unoserver: `unoserver --port 2002`
7. Run development server: `uvicorn app.main:app --reload`

### Key Environment Variables (`.env`)
- `SUPABASE_URL`, `SUPABASE_KEY`: For Supabase integration
- `LIBREOFFICE_PATH`: Path to `soffice` executable (required)
- `LOG_LEVEL`: Logging level (e.g., `INFO`, `DEBUG`)
- `TEMP_UPLOAD_DIR`, `TEMP_PROCESSING_DIR`: Temporary directories for processing

### Dependencies Fixed
- **Removed conflicting `uno` package**: Commented out to avoid pytest version conflicts
- **Added `fuzzywuzzy`**: For advanced text matching capabilities
- **Updated `python-json-logger`**: For structured logging support

## Technical Constraints & Decisions

### Modular Architecture Benefits
- **Separation of Concerns**: Each module has a clear, focused responsibility
- **Maintainability**: Smaller files (200-500 lines) easier to understand and modify
- **Testability**: Isolated modules enable comprehensive unit testing
- **Extensibility**: New features can be added without affecting core logic

### SVG Generation Strategy: Dual Approach
- **Primary**: UNO API for maximum control and individual slide processing
- **Fallback**: LibreOffice batch for reliability when UNO API fails
- **Rationale**: Balances control, visual quality, and robustness

### Enhanced Metadata Extraction
- **Cell-Level Table Processing**: Each table cell treated as independent translatable unit
- **Coordinate Validation**: SVG text matching ensures frontend overlay accuracy
- **Fuzzy Matching**: Handles slight text variations between extraction and SVG output

### Asynchronous Operations
- **FastAPI BackgroundTasks**: For main processing workflow
- **Async Retry Decorator**: For UNO API connection reliability
- **Proper Resource Management**: Async context managers for cleanup

### Configuration Management
- **Environment-Driven**: All configuration via environment variables
- **Module-Specific Settings**: Each module accesses relevant configuration
- **Docker-Ready**: Configuration optimized for containerized deployment

## Module-Specific Implementation

### SVG Generator Module Functions
1. `generate_svgs()` - Main entry point with dual strategy
2. `generate_svgs_via_uno_api()` - UNO API implementation with retry
3. `generate_svgs_via_libreoffice_batch()` - Batch conversion fallback
4. `validate_libreoffice_availability()` - System validation
5. `_get_uno_context_with_retry()` - Connection management with retry

### Slide Parser Module Functions
1. `extract_shapes_enhanced()` - Shape and table extraction
2. `validate_coordinates_with_svg()` - Complete coordinate validation
3. `create_thumbnail_from_slide_enhanced()` - Thumbnail generation
4. `_extract_svg_dimensions()` - SVG viewport analysis
5. `_calculate_coordinate_transform()` - Coordinate transformation
6. `_extract_svg_text_elements()` - SVG text element extraction
7. `_find_best_svg_text_match()` - Fuzzy text matching
8. `_apply_coordinate_validation()` - Validation application

## Dependencies (Updated Libraries)

### Core Dependencies
- `fastapi>=0.103.1`
- `uvicorn>=0.23.2`
- `python-multipart>=0.0.6`
- `pydantic>=2.4.2`
- `pydantic-settings>=2.0.3`

### Processing Dependencies
- `python-pptx>=0.6.21` - PPTX parsing and metadata extraction
- `pillow>=10.0.0` - Image processing and thumbnails
- `fuzzywuzzy` - Text matching for coordinate validation

### Integration Dependencies
- `supabase>=1.0.3` - Storage and database integration
- `storage3>=0.5.4` - Supabase storage client
- `python-json-logger` - Structured logging

### Utility Dependencies
- `python-dotenv>=1.0.0` - Environment variable management
- `aiofiles>=23.2.1` - Async file operations

### Development Dependencies
- `pytest>=7.4.2` - Testing framework
- `httpx>=0.25.0` - HTTP client for testing
- `ruff` - Linting and formatting

## Production Readiness Features

### Enhanced Error Handling
- **Module-Specific Strategies**: Each module handles its domain-specific errors
- **Retry Mechanisms**: Async retry for transient failures
- **Comprehensive Logging**: Structured JSON logs with rich context
- **Graceful Degradation**: Fallback strategies maintain functionality

### Performance Optimizations
- **Modular Processing**: Parallel opportunities between independent modules
- **Efficient Resource Usage**: Proper cleanup and resource management
- **Caching Support**: Framework for result caching and reuse
- **Timeout Management**: Configurable timeouts for long-running operations

### Monitoring & Observability
- **Structured Logging**: JSON format with contextual data
- **Status Tracking**: Comprehensive job status management
- **Health Checks**: Module-specific health validation
- **Performance Metrics**: Processing time tracking and optimization

## Docker Integration

### Container Optimization
- **LibreOffice Pre-installed**: Container includes properly configured LibreOffice
- **UNO Server Support**: Ready for UNO API operations
- **Environment Configuration**: All settings via environment variables
- **Health Checks**: Validates LibreOffice and UNO server availability

### Development Workflow
- **Docker Compose**: Easy development setup
- **Volume Mounts**: Proper development file handling
- **Hot Reload**: Development server with auto-reload
- **Debugging Support**: Container debugging capabilities

The modular technical architecture provides a robust foundation for maintainable, scalable, and reliable PPTX processing capabilities. 