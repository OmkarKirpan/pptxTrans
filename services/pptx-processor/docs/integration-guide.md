# PPTX Processor Service Integration Documentation

## Overview
The PPTX Processor Service is a Python FastAPI microservice that handles the conversion of PowerPoint (PPTX) files to SVG format, extracting text elements and their coordinates for interactive editing.

## Base URL
- Development: `http://localhost:8000`
- Production: `https://pptx-processor.pptxtrans.com` (placeholder - update with actual URL)

## Authentication
- Include the Supabase JWT token in the `Authorization` header
- Format: `Bearer <token>`

## API Endpoints

### 1. Process PPTX File
```
POST /v1/process
```

#### Request
- Content-Type: `multipart/form-data`
- Form Fields:
  - `file`: PPTX file (required)
  - `sessionId`: Unique session identifier (required)
  - `sessionName`: Display name for the session (optional)
  - `sourceLanguage`: Source language code (optional)
  - `targetLanguage`: Target language code (optional)

#### Response
```json
{
  "jobId": "job-abc123",
  "status": "processing",
  "estimatedTimeSeconds": 45,
  "sessionId": "session-123",
  "message": "Processing started"
}
```

### 2. Check Processing Status
```
GET /v1/status/{jobId}
```

#### Response
```json
{
  "jobId": "job-abc123",
  "status": "completed",
  "progress": 100,
  "sessionId": "session-123",
  "slideCount": 15,
  "message": "Processing complete",
  "completedAt": "2023-06-15T14:35:00Z"
}
```

Possible status values:
- `queued`: Job is waiting to be processed
- `processing`: Job is currently being processed
- `completed`: Job has completed successfully
- `failed`: Job has failed

### 3. Get Processing Results
```
GET /v1/results/{sessionId}
```

#### Response
```json
{
  "sessionId": "session-123",
  "slideCount": 15,
  "slides": [
    {
      "slideId": "slide-1",
      "slideNumber": 1,
      "svgUrl": "https://supabase-url/storage/slide_visuals/session-123/slide-1.svg",
      "thumbnailUrl": "https://supabase-url/storage/slide_visuals/session-123/thumbnails/slide-1.png",
      "width": 1280,
      "height": 720,
      "shapes": [
        {
          "shapeId": "shape-1",
          "type": "text",
          "originalText": "Slide Title",
          "translatedText": "",
          "x": 10.5,
          "y": 15.2,
          "width": 80.0,
          "height": 10.0,
          "styleData": {
            "fontSize": 44,
            "fontFamily": "Arial",
            "isBold": true
          }
        }
      ]
    }
  ]
}
```

### 4. Retry Failed Job
```
POST /v1/retry/{jobId}
```

#### Response
Same format as `/v1/process` endpoint

### 5. Health Check
```
GET /v1/health
```

#### Response
```json
{
  "status": "ok",
  "version": "1.0.0",
  "libreOfficeAvailable": true
}
```

## Error Handling
All endpoints return standard HTTP status codes with detailed error messages:

```json
{
  "error": {
    "code": "invalid_file_format",
    "message": "The uploaded file is not a valid PPTX file",
    "details": {
      "filename": "document.docx",
      "expectedFormat": "pptx"
    }
  }
}
```

## Frontend Integration Steps

### Upload Workflow
1. Create a translation session in Supabase
2. Upload PPTX file to the processor service using `/v1/process`
3. Store the returned `jobId` for status tracking
4. Implement polling to check status using `/v1/status/{jobId}`
5. Once status is `completed`, fetch results with `/v1/results/{sessionId}`
6. Render slides using the returned SVG URLs and shape data

### Recommended Polling Strategy
- Initial check after 2 seconds
- Subsequent checks every 5 seconds
- Exponential backoff for longer processing jobs
- Maximum polling duration: 5 minutes
- Display progress indicator based on `progress` field

## Database Integration
The service automatically updates the following Supabase tables:
- `slides`: Created for each slide with SVG URLs and dimensions
- `slide_shapes`: Created for each text element with coordinates and text content

## Configuration Requirements
Environment variables needed:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_KEY`: Supabase service role API key
- `PROCESSING_RESULTS_DIR`: Directory for temporary processing files
- `LIBREOFFICE_PATH`: Path to LibreOffice executable (e.g., `/usr/bin/libreoffice`)
- `MAX_CONCURRENT_JOBS`: Maximum number of concurrent processing jobs (default: 3)
- `JOB_TIMEOUT_SECONDS`: Maximum processing time per job (default: 300)

## LibreOffice Requirements
- LibreOffice must be installed on the server
- Minimum version: 7.0+
- For Windows: Ensure path includes `program` directory containing `soffice.exe`
- For Linux: Typically `/usr/bin/libreoffice` or `/usr/bin/soffice` 