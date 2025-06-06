# PPTX Processor Service: Frontend Integration Guide

This guide provides instructions for integrating the PPTX Processor Service with frontend applications.

## Service Overview

The PPTX Processor Service converts PowerPoint (PPTX) files to SVG images and extracts text data for translation workflows. It follows a batch/queue-based processing model with asynchronous job handling.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/process` | POST | Process a PPTX file |
| `/v1/status/{job_id}` | GET | Get processing status for a job |
| `/v1/results/{session_id}` | GET | Get processing results for a session |
| `/v1/health` | GET | Service health check |
| `/v1/metrics` | GET | Service metrics (requires auth) |

## Integration Steps

### 1. Client Configuration

Create a client class to interact with the PPTX Processor Service:

```typescript
// pptx-processor-client.ts
export class PptxProcessorClient {
  private baseUrl: string;
  private token?: string;
  
  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  
  async processPptx(
    file: File,
    sessionId: string,
    sourceLanguage?: string,
    targetLanguage?: string,
    generateThumbnails: boolean = true
  ): Promise<ProcessingResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    
    if (sourceLanguage) {
      formData.append('source_language', sourceLanguage);
    }
    
    if (targetLanguage) {
      formData.append('target_language', targetLanguage);
    }
    
    formData.append('generate_thumbnails', String(generateThumbnails));
    
    const response = await fetch(
      `${this.baseUrl}/v1/process`,
      {
        method: 'POST',
        headers: this.token ? {
          'Authorization': `Bearer ${this.token}`,
        } : {},
        body: formData,
      }
    );
    
    if (!response.ok) {
      this.handleErrorResponse(response);
    }
    
    return response.json();
  }
  
  async getProcessingStatus(jobId: string): Promise<ProcessingResponse> {
    const response = await fetch(
      `${this.baseUrl}/v1/status/${jobId}`,
      {
        headers: this.getHeaders(),
      }
    );
    
    if (!response.ok) {
      this.handleErrorResponse(response);
    }
    
    return response.json();
  }
  
  async getProcessingResults(sessionId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/results/${sessionId}`,
      {
        headers: this.getHeaders(),
      }
    );
    
    if (!response.ok) {
      this.handleErrorResponse(response);
    }
    
    return response.json();
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/health`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('PPTX processor health check failed:', error);
      return false;
    }
  }
  
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }
  
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = 'An unknown error occurred';
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      // If we can't parse the error response, use status text
      errorMessage = response.statusText || errorMessage;
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }
}
```

### 2. Type Definitions

Define TypeScript types for the API responses:

```typescript
// pptx-processor-types.ts
export enum ProcessingStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ProcessingResponse {
  job_id: string;
  session_id: string;
  status: ProcessingStatus;
  message: string;
  progress?: number;
  current_stage?: string;
  error?: string;
  estimated_completion_time?: string;
  completed_at?: string;
  result_url?: string;
  slide_count?: number;
}

export interface SlideShape {
  id: string;
  shape_ppt_id: string;
  type: string;
  original_text: string;
  translated_text?: string;
  x_coordinate: number;
  y_coordinate: number;
  width: number;
  height: number;
  coordinates_unit: string;
  font_family?: string;
  font_size?: number;
  is_bold?: boolean;
  is_italic?: boolean;
  text_color?: string;
  reading_order?: number;
  is_title?: boolean;
  is_subtitle?: boolean;
  translation_priority?: number;
}

export interface ProcessedSlide {
  id: string;
  slide_number: number;
  svg_url: string;
  original_width: number;
  original_height: number;
  shapes: SlideShape[];
}

export interface ProcessingResults {
  session_id: string;
  slide_count: number;
  slides: ProcessedSlide[];
}
```

### 3. Example Usage

#### 3.1 Uploading and Processing a PPTX File

```typescript
import { PptxProcessorClient } from './pptx-processor-client';
import { ProcessingStatus } from './pptx-processor-types';

// Initialize client
const client = new PptxProcessorClient(
  process.env.NEXT_PUBLIC_PPTX_PROCESSOR_URL || 'http://localhost:8000'
);

// File upload component
function FileUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      
      // Generate a session ID (or get it from your backend)
      const sessionId = crypto.randomUUID();
      
      // Process the file
      const result = await client.processPptx(
        file,
        sessionId,
        'en', // source language
        'es', // target language
        true  // generate thumbnails
      );
      
      setJobId(result.job_id);
      
      // Start polling for status
      pollJobStatus(result.job_id, sessionId);
    } catch (err) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Rest of component...
}
```

#### 3.2 Polling for Job Status

```typescript
const pollJobStatus = async (jobId: string, sessionId: string) => {
  // Poll until job is complete or failed
  const intervalId = setInterval(async () => {
    try {
      const status = await client.getProcessingStatus(jobId);
      
      // Update UI with status.progress, status.current_stage, etc.
      
      if (status.status === ProcessingStatus.COMPLETED) {
        clearInterval(intervalId);
        // Fetch results
        const results = await client.getProcessingResults(sessionId);
        // Handle completed results
        handleCompletedResults(results);
      } else if (status.status === ProcessingStatus.FAILED) {
        clearInterval(intervalId);
        setError(status.error || 'Processing failed');
      }
    } catch (err) {
      clearInterval(intervalId);
      setError(err.message || 'Failed to check status');
    }
  }, 2000); // Poll every 2 seconds
  
  // Clean up interval on component unmount
  return () => clearInterval(intervalId);
};
```

#### 3.3 Rendering Processed Slides

```typescript
import { ProcessedSlide } from './pptx-processor-types';

interface SlideCanvasProps {
  slide: ProcessedSlide;
}

function SlideCanvas({ slide }: SlideCanvasProps) {
  if (!slide || !slide.svg_url) {
    return <div>No slide data available</div>;
  }
  
  return (
    <div className="relative" style={{ 
      width: '100%',
      maxWidth: `${slide.original_width}px`,
      aspectRatio: `${slide.original_width / slide.original_height}`
    }}>
      {/* SVG Background */}
      <img 
        src={slide.svg_url} 
        alt={`Slide ${slide.slide_number}`}
        className="w-full h-full object-contain"
      />
      
      {/* Interactive Text Overlays */}
      {slide.shapes.map(shape => {
        if (shape.type !== 'text') return null;
        
        const positionStyle = {
          left: `${shape.x_coordinate}%`,
          top: `${shape.y_coordinate}%`,
          width: `${shape.width}%`,
          height: `${shape.height}%`,
          position: 'absolute',
        };
        
        return (
          <div 
            key={shape.id}
            style={positionStyle}
            className="cursor-pointer border border-transparent hover:border-blue-500"
            onClick={() => handleTextClick(shape)}
          >
            {/* Optional: render text overlay */}
          </div>
        );
      })}
    </div>
  );
}
```

### 4. Error Handling

Implement comprehensive error handling:

```typescript
try {
  const result = await client.processPptx(file, sessionId);
  // Handle success
} catch (error) {
  // Check specific error types
  if (error.status === 401) {
    // Authentication error
  } else if (error.status === 413) {
    // File too large
  } else if (error.message.includes('unsupported file type')) {
    // Invalid file type
  } else {
    // Generic error
  }
}
```

### 5. Best Practices

#### 5.1 File Size Handling

- Implement client-side file size validation (max 50MB recommended)
- Show progress indicator for large file uploads
- Consider implementing chunked uploads for very large files

```typescript
// Client-side file size validation
if (file.size > 50 * 1024 * 1024) { // 50MB
  setError('File size exceeds the maximum limit of 50MB');
  return;
}
```

#### 5.2 Service Availability

- Check service health before attempting uploads
- Implement graceful fallbacks for service unavailability

```typescript
async function checkServiceAvailability() {
  const isAvailable = await client.checkHealth();
  if (!isAvailable) {
    // Show warning or disable upload functionality
  }
}
```

#### 5.3 User Experience

- Show processing status and progress to users
- Implement cancellation if the service supports it
- Provide clear error messages and recovery options

```typescript
function ProcessingStatus({ jobId, onCancel }) {
  const [status, setStatus] = useState({ progress: 0, stage: 'Initializing' });
  
  // Polling logic here...
  
  return (
    <div className="processing-status">
      <div className="progress-bar" style={{ width: `${status.progress}%` }}></div>
      <div className="status-text">{status.stage} ({status.progress}%)</div>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

### 6. Complete Integration Example

```typescript
import { useState, useEffect } from 'react';
import { PptxProcessorClient } from './pptx-processor-client';
import { ProcessingStatus, ProcessingResults } from './pptx-processor-types';

const client = new PptxProcessorClient(process.env.NEXT_PUBLIC_PPTX_PROCESSOR_URL);

export function PptxUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [status, setStatus] = useState<string>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<string>('');
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [error, setError] = useState<string>('');

  // Generate session ID on component mount
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      if (!selectedFile.name.endsWith('.pptx')) {
        setError('Please select a valid PPTX file');
        return;
      }
      
      // Validate file size (50MB max)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size exceeds the maximum limit of 50MB');
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  // Upload and process handler
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    try {
      // Check service health first
      const isHealthy = await client.checkHealth();
      if (!isHealthy) {
        setError('PPTX processing service is currently unavailable');
        return;
      }
      
      // Start processing
      setStatus('uploading');
      setProgress(0);
      setStage('Uploading file');
      
      const response = await client.processPptx(
        file,
        sessionId,
        'en', // Source language
        '', // Target language (optional)
        true // Generate thumbnails
      );
      
      setJobId(response.job_id);
      setStatus('processing');
      setProgress(response.progress || 0);
      setStage(response.current_stage || 'Processing started');
      
      // Start polling for status
      startStatusPolling(response.job_id);
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Failed to process file');
    }
  };
  
  // Status polling function
  const startStatusPolling = (jobId: string) => {
    const intervalId = setInterval(async () => {
      try {
        const statusResponse = await client.getProcessingStatus(jobId);
        
        setProgress(statusResponse.progress || 0);
        setStage(statusResponse.current_stage || '');
        
        if (statusResponse.status === ProcessingStatus.COMPLETED) {
          clearInterval(intervalId);
          setStatus('completed');
          
          // Fetch results
          const resultsData = await client.getProcessingResults(sessionId);
          setResults(resultsData);
        } else if (statusResponse.status === ProcessingStatus.FAILED) {
          clearInterval(intervalId);
          setStatus('error');
          setError(statusResponse.error || 'Processing failed');
        }
      } catch (err) {
        clearInterval(intervalId);
        setStatus('error');
        setError(err.message || 'Failed to check processing status');
      }
    }, 2000);
    
    // Clean up on component unmount
    return () => clearInterval(intervalId);
  };

  // Render different UI based on status
  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <div>
            <input type="file" accept=".pptx" onChange={handleFileChange} />
            <button 
              onClick={handleUpload} 
              disabled={!file}
            >
              Upload and Process
            </button>
          </div>
        );
        
      case 'uploading':
      case 'processing':
        return (
          <div>
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            <p>{stage} ({progress}%)</p>
          </div>
        );
        
      case 'completed':
        return (
          <div>
            <h3>Processing Complete!</h3>
            <p>Processed {results?.slide_count || 0} slides</p>
            {/* Render slides or provide navigation to editor */}
            <button onClick={() => {/* Navigate to editor */}}>
              Edit Slides
            </button>
          </div>
        );
        
      case 'error':
        return (
          <div>
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={() => setStatus('idle')}>Try Again</button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="pptx-uploader">
      <h2>PPTX Processor</h2>
      {renderContent()}
    </div>
  );
}
```

## Webhooks (Optional)

If your application requires server-to-server notifications when processing is complete, you can implement webhook support:

```typescript
// When starting processing, include a webhook URL
const result = await client.processPptx(
  file,
  sessionId,
  'en',
  'es',
  true,
  'https://your-app.com/api/pptx-webhooks'
);

// On your server, handle the webhook
export async function POST(req: Request) {
  const webhookData = await req.json();
  
  // Verify the webhook signature if implemented
  
  // Process the webhook data
  if (webhookData.status === 'completed') {
    // Update your database
    // Notify users
    // Trigger follow-up processes
  }
  
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Conclusion

This guide provides a comprehensive overview of integrating the PPTX Processor Service with frontend applications. For additional assistance or advanced integration scenarios, please contact the development team. 