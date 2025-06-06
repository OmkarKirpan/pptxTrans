# PPTX Processor Service

A Python-based microservice for converting PowerPoint (PPTX) presentations to SVGs using LibreOffice and extracting text data with precise positioning information using python-pptx. This service is a critical component of the PowerPoint Translator App, enabling high-fidelity slide rendering and text translation while maintaining visual fidelity.

## 🎯 Core Features

- **LibreOffice SVG Generation**: High-quality SVG conversion using LibreOffice headless mode
- **Enhanced Text Extraction**: Precise text positioning optimized for translation workflows
- **Translation-Ready Metadata**: Structured data designed for frontend overlay rendering
- **Docker-First Deployment**: Containerized environment with LibreOffice pre-installed
- **Supabase Integration**: Seamless storage and database integration
- **Frontend Optimized**: API responses designed for slidecanvas component integration

## 🏗️ Architecture

### Simplified Processing Pipeline
```
PPTX Upload → LibreOffice Batch SVG → Enhanced Text Extraction → Supabase Storage → Frontend Integration
```

### Key Components
- **FastAPI**: High-performance async web framework
- **LibreOffice Headless**: Primary and only SVG generation method
- **Python-PPTX Enhanced**: Translation-optimized text extraction
- **Supabase**: Storage and database integration
- **Docker**: Containerized deployment environment

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Supabase project (local or cloud)

### Environment Setup
1. Copy environment template:
```bash
cp env.example .env
```

2. Configure environment variables:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# LibreOffice Configuration
LIBREOFFICE_PATH=/usr/bin/soffice
LOG_LEVEL=INFO

# Processing Configuration
TEMP_UPLOAD_DIR=/tmp/uploads
TEMP_PROCESSING_DIR=/tmp/processing
```

### Docker Development
```bash
# Build and run the service
docker-compose up --build

# Or run in development mode
docker-compose up -d
docker-compose logs -f pptx-processor
```

### Local Development (Alternative)
```bash
# Install dependencies
uv pip install -r requirements.txt

# Run the service
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 📊 API Endpoints

### Core Processing
- `POST /api/v1/process` - Upload and process PPTX file
- `GET /api/v1/status/{job_id}` - Check processing status
- `GET /api/v1/results/{session_id}` - Get processing results

### Health & Monitoring
- `GET /health` - Service health check
- `GET /health/libreoffice` - LibreOffice availability check

### API Documentation
- `GET /docs` - Interactive Swagger UI
- `GET /redoc` - ReDoc documentation

## 🔧 Configuration

### LibreOffice Configuration
The service uses LibreOffice in headless mode for SVG generation. Key configuration options:

```env
LIBREOFFICE_PATH=/usr/bin/soffice  # Path to LibreOffice executable
LIBREOFFICE_TIMEOUT=300           # Processing timeout in seconds
```

### Processing Configuration
```env
MAX_FILE_SIZE_MB=50              # Maximum PPTX file size
CONCURRENT_PROCESSING=4          # Number of concurrent processing jobs
SVG_QUALITY=high                 # SVG output quality setting
```

### Supabase Integration
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_service_role_key
STORAGE_BUCKET_SLIDES=slide-visuals
STORAGE_BUCKET_RESULTS=processing-results
```

## 🏆 Integration Guide

### Frontend Integration
The service is designed to integrate seamlessly with the Next.js frontend slidecanvas component:

```typescript
// Example API usage
const response = await fetch('/api/v1/process', {
  method: 'POST',
  body: formData  // FormData with PPTX file
});

const result = await response.json();
// result.session_id - for tracking
// result.job_id - for status polling
```

### Data Structure
The service returns translation-optimized data:

```typescript
interface ProcessedSlide {
  id: string;
  session_id: string;
  slide_number: number;
  svg_url: string;           // LibreOffice-generated SVG
  original_width: number;
  original_height: number;
  thumbnail_url: string;
  shapes: SlideShape[];      // Enhanced text extraction
}

interface SlideShape {
  id: string;
  content: string;           // Original text
  translated_content?: string;
  x: number;                 // Precise coordinates
  y: number;
  width: number;
  height: number;
  font_size: number;
  font_family: string;
  is_title: boolean;
  // Additional translation metadata...
}
```

## 🔍 Development

### Project Structure
```
app/
├── api/                   # API routes
│   └── routes/
├── core/                  # Configuration and settings
├── models/                # Pydantic models
├── services/              # Business logic
│   ├── pptx_processor.py  # Main processing orchestrator
│   ├── svg_generator.py   # Handles SVG generation (UNO API + Batch)
│   ├── slide_parser.py    # Extracts text and shapes from PPTX
│   ├── supabase_service.py# Manages all Supabase interactions (DB & Storage)
│   ├── job_status.py      # Manages local, real-time job status for polling
│   ├── processing_manager.py # Manages the background job queue
│   ├── worker_pool.py     # Manages the concurrent worker pool (Semaphore)
│   ├── cache_service.py   # Handles caching of processed results
│   ├── results_service.py # Retrieves final results (from storage or DB)
│   └── pptx_export.py     # (Placeholder) For future export-to-PPTX feature
└── main.py                # FastAPI application

docs/                      # Documentation
memory-bank/               # Project context and progress
tests/                     # Test files
```

### Key Services

#### PPTX Processor (`app/services/pptx_processor.py`)
The main orchestrator service. It's responsible for coordinating the entire processing workflow, checking the cache, calling the SVG generator and slide parser, and updating status via both the local and Supabase services.

#### ProcessingManager & WorkerPool (`app/services/processing_manager.py`, `app/services/worker_pool.py`)
These services manage the background job queue and concurrency. When a new job is submitted, the `ProcessingManager` adds it to a queue and the `WorkerPool` ensures it's picked up by a worker when a slot is free, preventing the system from being overloaded.

#### Dual Status Services (`app/services/job_status.py` & `app/services/supabase_service.py`)
The application uses two channels for status updates:
- **`job_status.py`**: Provides granular, real-time updates to a local file. This is used for the client to poll for progress.
- **`supabase_service.py`**: Updates the persistent, high-level status in the main database (e.g., "completed", "failed").

#### Cache Service (`app/services/cache_service.py`)
A file-based cache that stores the results of previous processing jobs. It generates a key based on the file content and parameters, which dramatically speeds up reprocessing of the same file.

#### Supabase Service (`app/services/supabase_service.py`)
This service isolates all interactions with Supabase, including uploading files to storage buckets and reading/writing job results and status to the database.

### Testing

The project uses `pytest` for testing. The tests are located in the `tests/` directory and are designed to run without requiring external services like a running Supabase instance, as these dependencies are mocked.

**Running the Integration Tests:**

To run the main integration test suite, use the following command:

```bash
# Run the integration tests for the processing endpoints
uv run pytest tests/integration/test_processing_routes.py
```

This will execute tests that cover:
- Successful file uploads using the `UnderstandRatios.pptx` test file.
- Handling of unsupported file types.
- Validation of required request data.

**Running All Tests:**

To run the entire test suite:

```bash
# Run all tests
uv run pytest
```

## 🐳 Docker Deployment

### Production Dockerfile
The service includes a production-ready Dockerfile with:
- LibreOffice pre-installed and configured
- Optimized Python dependencies
- Health checks and monitoring
- Security best practices

### Docker Compose
```yaml
version: '3.8'
services:
  pptx-processor:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
    volumes:
      - ./tmp:/tmp
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 🔧 Troubleshooting

### Common Issues

#### LibreOffice Not Found
```bash
# Check LibreOffice installation
which soffice
# Install LibreOffice (Ubuntu/Debian)
apt-get install libreoffice
```

#### SVG Generation Fails
```bash
# Test LibreOffice manually
soffice --headless --convert-to svg:"impress_svg_Export" presentation.pptx
```

#### Permission Issues
```bash
# Fix file permissions
chmod +x /usr/bin/soffice
chown -R app:app /tmp/processing
```

### Monitoring
```bash
# Check service logs
docker-compose logs pptx-processor

# Monitor processing jobs
curl http://localhost:8000/health
```

## 📚 Documentation

- [Integration Guide](docs/INTEGRATION.md) - Detailed integration documentation
- [API Reference](docs/API.md) - Complete API documentation
- [Development Guide](docs/DEVELOPMENT.md) - Development setup and guidelines
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment instructions

## 🤝 Contributing

1. Review the [memory-bank](memory-bank/) for project context
2. Follow the development setup instructions
3. Run tests before submitting changes
4. Update documentation for new features

## 📋 Requirements

### System Requirements
- Python 3.12+
- LibreOffice 7.0+
- Docker 20.0+
- 2GB RAM minimum
- 1GB disk space for processing

### Dependencies
- FastAPI - Web framework
- python-pptx - PPTX parsing
- Pillow - Image processing
- Supabase - Storage and database
- UV - Package management

## 📄 License

This project is part of the PowerPoint Translator App MVP.

## 🔗 Related Services

- [Frontend Application](../../) - Next.js frontend
- [Audit Service](../audit-service/) - Activity logging
- [Share Service](../share-service/) - Secure sharing
- [Translation Session Service](../translation-session-service/) - Session management 