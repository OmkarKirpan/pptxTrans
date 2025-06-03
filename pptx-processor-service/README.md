# PPTX Processor Service

A simple microservice for converting PowerPoint presentations to SVGs and extracting text data with positioning information.

## Features

- Convert PPTX slides to SVG format
- Extract text elements with precise coordinates and styling information
- Generate thumbnails for each slide
- Provide metadata for text display in slidecanvas frontend component
- Store processed assets in Supabase Storage (configured via environment variables)

## Getting Started

### Prerequisites

- Python 3.8 or higher
- UV (package management tool)
- Supabase (local or cloud instance)

### Installation

1. Clone the repository
2. Install dependencies with UV:

```bash
uv pip install -r requirements.txt
```

3. Create a `.env` file based on the `env.example` file:

```bash
# Server
API_ENV=development
API_PORT=8000
API_HOST=0.0.0.0
LOG_LEVEL=INFO

# Storage paths
TEMP_UPLOAD_DIR=./tmp/uploads
TEMP_PROCESSING_DIR=./tmp/processing

# Supabase (update these with your actual values)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_STORAGE_BUCKET=slide-visuals

# Security
ALLOWED_ORIGINS=http://localhost:3000
```

### Supabase Setup

#### 1. Database Setup

Run the SQL script to create required tables:

```bash
# Using Supabase Studio (recommended):
# 1. Go to http://127.0.0.1:54323
# 2. Navigate to SQL Editor
# 3. Copy and paste contents of supabase_setup.sql
# 4. Click Run
```

#### 2. Storage Setup

Follow the instructions in `STORAGE_SETUP.md` to create the required storage buckets through the Supabase Studio UI.

### Running the Service

```bash
python main.py
```

The API will be available at `http://localhost:8000`.

## API Endpoints

### Process a PPTX File

```
POST /api/process
```

**Form Data:**
- `file`: The PPTX file to process
- `session_id`: Unique identifier for the translation session
- `source_language` (optional): The source language of the presentation
- `target_language` (optional): The target language for translation
- `generate_thumbnails` (optional, default: true): Whether to generate slide thumbnails

**Response:**
```json
{
  "job_id": "uuid",
  "session_id": "your-session-id",
  "status": "QUEUED",
  "message": "PPTX processing has been queued",
  "estimated_completion_time": "2025-06-02T12:00:00Z"
}
```

### Check Processing Status

```
GET /status/{job_id}
```

**Response:**
```json
{
  "job_id": "uuid",
  "session_id": "your-session-id",
  "status": "COMPLETED",
  "progress": 100,
  "current_stage": "Processing completed",
  "completed_at": "2025-06-02T12:05:00Z"
}
```

### Health Check

```
GET /health
```

## Architecture

This service is built with:

- **FastAPI**: Web framework for API endpoints
- **Python-PPTX**: Library for parsing PowerPoint files
- **Custom SVG Generation**: Using ElementTree to generate SVGs without dependencies
- **Supabase**: Storage for assets (configured via environment variables)

## Implementation Notes

- SVG conversion is done by extracting elements from PPTX and rendering to SVG format
- Text extraction preserves positioning and basic styling information
- Direct SVG generation avoids dependencies on Cairo or other rendering libraries
- Asynchronous processing with FastAPI background tasks
- Compatible with Windows development environment
- Supabase credentials are configured via environment variables, not passed in requests

## License

MIT 