# PowerPoint Translator App Integration Documentation

This document provides technical details and instructions for integrating with the PowerPoint Translator application. It covers the file upload process, storage structure, API endpoints, and integration requirements.

## System Architecture Overview

The PowerPoint Translator application consists of the following components:

1. **Frontend Application**: Next.js 14 app with React/TypeScript
2. **Supabase Backend**: Provides authentication, database, and storage
3. **PPTX Processor Service**: Microservice for processing PPTX files and extracting slide data
4. **Audit Service**: Records user activities and session changes

## Storage Structure

### Supabase Storage Buckets

The application uses the following Supabase storage buckets:

1. **pptx-files**: Stores original uploaded PPTX files
   - Path format: `uploads/{userId}/{timestamp}_{filename}.pptx`
   - Example: `uploads/123e4567-e89b-12d3-a456-426614174000/1620000000000_presentation.pptx`

2. **slide-visuals**: Stores generated SVG and thumbnail images for slides
   - SVG path format: `{sessionId}/slide_{slideNumber}.svg`
   - Thumbnail path format: `{sessionId}/thumbnails/slide_{slideNumber}.png`

3. **processing-results**: Stores JSON results from the PPTX processor
   - Path format: `{sessionId}/result.json`

### File Naming Convention

- Uploaded files: `{timestamp}_{originalFilename}.pptx`
  - This prevents filename collisions and maintains original file metadata
- Processed assets: Use standardized formats with session IDs and slide numbers
  - Example: `123e4567-e89b-12d3/slide_1.svg`

## PPTX Processing Flow

1. User uploads PPTX file to the frontend
2. File is stored in Supabase `pptx-files` bucket
3. Session is created in the database with original file path
4. PPTX file is sent to the PPTX Processor service via API
5. Processor service extracts slide data, generates SVGs, and stores results
6. Frontend retrieves processed slide data for display and editing

## API Endpoints

### PPTX Processor Service

Base URL: `http://localhost:3001` (development) or configured production URL

#### Process PPTX

```
POST /api/process
```

Request:
- Format: `multipart/form-data`
- Parameters:
  - `file`: PPTX file (required)
  - `session_id`: UUID string (required)
  - `source_language`: ISO language code (optional)
  - `target_language`: ISO language code (optional)
  - `generate_thumbnails`: Boolean, default `true` (optional)

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "queued",
  "progress": 0,
  "message": "PPTX processing has been queued",
  "estimated_completion_time": "2023-06-01T12:30:00Z"
}
```

#### Check Processing Status

```
GET /api/status/{job_id}
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "processing",
  "progress": 65,
  "current_stage": "Generating SVGs for slides"
}
```

#### Get Processing Results

```
GET /api/results/{session_id}
```

Response: Full slide data structure (see database schema)

## Database Schema

### Key Tables

1. **translation_sessions**
   - `id`: UUID (primary key)
   - `user_id`: UUID (foreign key to auth.users)
   - `name`: String
   - `status`: Enum ("draft", "in-progress", "ready")
   - `progress`: Integer (0-100)
   - `slide_count`: Integer
   - `source_language`: String (ISO code)
   - `target_language`: String (ISO code)
   - `original_file_path`: String (path in storage)
   - `thumbnail_url`: String (URL)
   - Timestamps

2. **slides**
   - `id`: UUID (primary key)
   - `session_id`: UUID (foreign key)
   - `slide_number`: Integer
   - `svg_url`: String (URL)
   - `original_width`: Integer
   - `original_height`: Integer
   - `thumbnail_url`: String (URL)
   - Timestamps

3. **slide_shapes**
   - `id`: UUID (primary key)
   - `slide_id`: UUID (foreign key)
   - `shape_type`: String
   - `original_text`: Text
   - `translated_text`: Text
   - `x_coordinate`, `y_coordinate`: Float
   - `width`, `height`: Float
   - `coordinates_unit`: Enum ("percentage", "px")
   - Font properties (family, size, weight, style)
   - Timestamps

## Integration Steps

### Frontend to PPTX Processor Integration

1. Create a session in the database
2. Upload PPTX file to Supabase storage
3. Call the PPTX processor API with the file and session ID
4. Monitor processing status (polling or webhook)
5. When complete, load slides and display in editor

### Developer Setup Requirements

1. Supabase project with configured storage buckets
2. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
   - `NEXT_PUBLIC_PPTX_PROCESSOR_URL`
   - `NEXT_PUBLIC_AUDIT_SERVICE_URL`

3. Running instances of:
   - PPTX Processor service
   - Audit service

## Example Integration Code

### File Upload to Supabase Storage

```typescript
const uploadFileToSupabase = async (file: File, userId: string) => {
  const timestamp = new Date().getTime();
  const uniqueFilename = `${timestamp}_${file.name}`;
  const filePath = `uploads/${userId}/${uniqueFilename}`;
  
  const { data, error } = await supabase.storage
    .from('pptx-files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: (progress) => {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        // Update UI with progress
      }
    });
  
  if (error) throw error;
  
  const publicUrl = supabase.storage
    .from('pptx-files')
    .getPublicUrl(filePath);
  
  return {
    path: filePath,
    publicUrl: publicUrl.data.publicUrl
  };
};
```

### Process PPTX File

```typescript
const processPptx = async (file: File, sessionId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);
  formData.append('generate_thumbnails', 'true');
  
  const response = await fetch(
    `${PPTX_PROCESSOR_URL}/api/process`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to process PPTX file');
  }
  
  return response.json();
};
```

## Error Handling

- File upload errors: Check Supabase storage permissions and bucket configuration
- Processing errors: Check PPTX processor logs and ensure service is running
- Database errors: Verify schema and permissions for the application user

## Troubleshooting

- **File upload fails**: Verify Supabase storage RLS policies and bucket existence
- **Processing hangs**: Check PPTX processor service logs
- **Missing slide data**: Verify processing completed successfully
- **Authentication issues**: Check JWT token configuration

## Contact

For integration support, contact the development team at dev@example.com. 