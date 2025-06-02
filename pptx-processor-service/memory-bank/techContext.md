# Technical Context

## Technologies Used

### Core Framework
- **FastAPI**: Modern, high-performance Python web framework
  - Async support for handling concurrent requests
  - Built-in validation via Pydantic
  - OpenAPI documentation generation

### PPTX Processing
- **python-pptx**: Library for reading and writing PowerPoint (.pptx) files
- **CairoSVG**: SVG rendering and manipulation tool
- **ReportLab**: PDF generation library
- **Pillow**: Python Imaging Library for image processing

### Backend and Storage
- **Supabase**: Backend-as-a-Service platform
  - Storage for PPTX files, generated SVGs, and thumbnails
  - Database for session management
- **storage3**: Supabase Storage client for Python

### Task Queue
- **Celery**: Distributed task queue
- **Redis**: Message broker for Celery

### Utilities
- **python-multipart**: Multipart form data parsing
- **python-dotenv**: Environment variable management
- **tenacity**: Retry library for resilient operations
- **aiofiles**: Asynchronous file operations

### Monitoring
- **prometheus-client**: Metrics collection
- **opentelemetry**: Distributed tracing

### Testing
- **pytest**: Testing framework
- **httpx**: HTTP client for testing FastAPI applications

### Package Management
- **UV**: Fast Python package installer and resolver (replacing pip)

## Current Technical Issues

### 1. Cairo Library on Windows
- **Problem**: CairoSVG requires Cairo C library to be installed separately on Windows
- **Error**: `OSError: no library called "cairo-2" was found`
- **Solutions**:
  - Install GTK+ for Windows (includes Cairo)
  - Use alternative SVG generation method
  - Switch to image-based output (PNG/JPG)

### 2. Missing Core Implementation
- **Problem**: PPTX to SVG conversion uses placeholder/mock implementation
- **Impact**: No actual slide rendering happens
- **Solutions**:
  - Implement custom SVG generation using python-pptx
  - Use LibreOffice headless mode
  - Use cloud conversion service

### 3. Unnecessary Complexity
- **Problem**: Redis/Celery adds complexity without benefit for simple use case
- **Impact**: Extra dependencies and setup required
- **Solution**: Use FastAPI BackgroundTasks or direct processing

## Development Setup (Current)

### Environment Requirements
- Python 3.10+
- Redis server (for Celery)
- Cairo library (for CairoSVG)
- Supabase account and project

### Working Local Development Steps
1. Clone repository
2. Create virtual environment
3. Install dependencies with UV
4. Configure environment variables
5. Fix Cairo dependency issue
6. Run development server with uvicorn

### Environment Variables Status
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase API key
- `REDIS_URL`: Redis connection string
- `TEMP_DIR`: Directory for temporary file processing
- `LOG_LEVEL`: Logging level configuration

## Technical Constraints

### Performance Considerations
- Large PPTX files can consume significant memory during processing
- SVG generation is CPU-intensive
- Complex slides with many elements take longer to process

### Security Requirements
- Secure handling of user-uploaded content
- API key protection
- Proper input validation and sanitization

### Scalability Considerations
- Horizontal scaling for handling multiple concurrent requests
- Memory usage optimization for large files
- Resource throttling to prevent overload

### Current Limitations
- No actual PPTX to SVG conversion implemented
- Cairo dependency prevents running on Windows
- Mock implementation returns placeholder data
- Text extraction is oversimplified

## Recommended Technical Stack (Simplified)

### For PPTX to SVG Conversion
**Option 1: Pure Python Solution**
- Use python-pptx to extract slide elements
- Generate SVG manually using xml.etree or svgwrite
- Use Pillow for image elements
- No Cairo dependency

**Option 2: LibreOffice Headless**
- Install LibreOffice
- Use subprocess to convert PPTX to SVG
- Most accurate rendering
- Cross-platform compatible

**Option 3: Image-based Approach**
- Convert slides to PNG/JPG instead of SVG
- Use python-pptx + Pillow
- Simpler but less scalable for frontend

### Simplified Dependencies
Remove from requirements.txt:
- celery
- redis
- cairosvg (replace with alternative)

Add/Keep:
- python-pptx (for PPTX parsing)
- pillow (for image processing)
- svgwrite or xml.etree (for SVG generation)
- fastapi, uvicorn (web framework)
- supabase (storage)

## Dependencies
Key dependency versions are managed in requirements.txt, with the following major components:
- fastapi >= 0.103.1
- python-pptx >= 0.6.21
- cairosvg >= 2.7.0
- supabase >= 1.0.3
- celery >= 5.3.4 