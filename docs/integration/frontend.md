# Frontend Service Integration Guide

This document explains how to integrate the Next.js frontend with both the PPTX Processor Service and Audit Service.

## Overview

The PowerPoint Translator App consists of three main components:

1. **Next.js Frontend** - The user interface and client-side application
2. **PPTX Processor Service** - Python microservice for PPTX processing
3. **Audit Service** - Go microservice for audit logging

This guide focuses on connecting these services together from the frontend perspective.

## Environment Configuration

Add the following environment variables to your `.env.local` file:

```
# Base URLs for microservices
NEXT_PUBLIC_PPTX_PROCESSOR_URL=http://localhost:8000
NEXT_PUBLIC_AUDIT_SERVICE_URL=http://localhost:8080

# For server components (Next.js route handlers)
PPTX_PROCESSOR_URL=http://localhost:8000
AUDIT_SERVICE_URL=http://localhost:8080

# Service timeouts
PPTX_PROCESSOR_TIMEOUT_MS=30000
AUDIT_SERVICE_TIMEOUT_MS=5000
```

## PPTX Processor Service Integration

### Client-Side Integration

1. **Service Client**

Create a client class in `lib/services/pptx-processor-client.ts`:

```typescript
import { ProcessingResponse, ProcessingStatusResponse, ProcessedPresentation } from '@/types';

export class PptxProcessorClient {
  private baseUrl: string;
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_PPTX_PROCESSOR_URL || 'http://localhost:8000';
  }
  
  async uploadPptx(file: File, sessionId: string, sessionName?: string): Promise<ProcessingResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    if (sessionName) formData.append('sessionName', sessionName);
    
    const response = await fetch(`${this.baseUrl}/v1/process`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload PPTX');
    }
    
    return response.json();
  }
  
  async checkStatus(jobId: string): Promise<ProcessingStatusResponse> {
    const response = await fetch(`${this.baseUrl}/v1/status/${jobId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to check processing status');
    }
    
    return response.json();
  }
  
  async getResults(sessionId: string): Promise<ProcessedPresentation> {
    const response = await fetch(`${this.baseUrl}/v1/results/${sessionId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to retrieve results');
    }
    
    return response.json();
  }
  
  async retry(jobId: string): Promise<ProcessingResponse> {
    const response = await fetch(`${this.baseUrl}/v1/retry/${jobId}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to retry processing');
    }
    
    return response.json();
  }
}
```

2. **Integration in Upload Wizard**

Update `components/dashboard/upload-wizard.tsx` to use the PPTX Processor client:

```typescript
import { useState } from 'react';
import { PptxProcessorClient } from '@/lib/services/pptx-processor-client';
import { createClient } from '@/lib/supabase/client';

// Within your component
const [file, setFile] = useState<File | null>(null);
const [jobId, setJobId] = useState<string | null>(null);
const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
const processorClient = new PptxProcessorClient();
const supabase = createClient();

const handleUpload = async () => {
  if (!file) return;
  
  try {
    setStatus('uploading');
    
    // 1. Create a session in Supabase
    const { data: sessionData, error: sessionError } = await supabase
      .from('translation_sessions')
      .insert({
        name: sessionName,
        source_language: sourceLanguage,
        target_language: targetLanguage,
      })
      .select()
      .single();
    
    if (sessionError) throw sessionError;
    
    // 2. Upload to processor service
    const response = await processorClient.uploadPptx(
      file, 
      sessionData.id,
      sessionData.name
    );
    
    setJobId(response.jobId);
    setStatus('processing');
    
    // 3. Start polling for status
    pollStatus(response.jobId);
    
  } catch (error) {
    console.error('Upload failed:', error);
    setStatus('error');
  }
};

const pollStatus = async (jobId: string) => {
  try {
    const response = await processorClient.checkStatus(jobId);
    
    if (response.status === 'completed') {
      setStatus('completed');
      // Navigate to editor
      router.push(`/editor/${response.sessionId}`);
    } else if (response.status === 'failed') {
      setStatus('error');
    } else {
      // Continue polling
      setTimeout(() => pollStatus(jobId), 3000);
    }
  } catch (error) {
    console.error('Status check failed:', error);
    setStatus('error');
  }
};
```

### Server-Side Integration

For server components or route handlers, create a server-side client in `lib/services/pptx-processor-server.ts`:

```typescript
import { ProcessingResponse, ProcessingStatusResponse, ProcessedPresentation } from '@/types';

export class PptxProcessorServer {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.PPTX_PROCESSOR_URL || 'http://localhost:8000';
  }
  
  // Similar methods to the client-side implementation, but for server use
}
```

## Audit Service Integration

### Client-Side Integration

1. **Audit Service Client**

Create an audit service client in `lib/services/audit-service-client.ts`:

```typescript
import { AuditEvent, AuditEventCreateParams, AuditResponse } from '@/types';

export class AuditServiceClient {
  private baseUrl: string;
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://localhost:8080';
  }
  
  async createEvent(params: AuditEventCreateParams): Promise<AuditEvent> {
    const response = await fetch(`${this.baseUrl}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create audit event');
    }
    
    return response.json();
  }
  
  async getSessionHistory(
    sessionId: string, 
    limit = 20, 
    offset = 0, 
    types?: string[],
    shareToken?: string
  ): Promise<AuditResponse> {
    let url = `${this.baseUrl}/api/v1/sessions/${sessionId}/history?limit=${limit}&offset=${offset}`;
    
    if (types && types.length > 0) {
      url += `&types=${types.join(',')}`;
    }
    
    const headers: Record<string, string> = {};
    
    if (shareToken) {
      headers['X-Share-Token'] = shareToken;
    } else {
      headers['Authorization'] = `Bearer ${await this.getToken()}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to retrieve audit history');
    }
    
    return response.json();
  }
  
  private async getToken(): Promise<string> {
    // Get token from your auth provider (e.g., Supabase)
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }
}
```

2. **Audit Queue Service**

Create a queue service for reliable audit event submission in `lib/services/audit-queue-service.ts`:

```typescript
import { AuditEventCreateParams } from '@/types';
import { AuditServiceClient } from './audit-service-client';

interface QueuedEvent {
  params: AuditEventCreateParams;
  timestamp: number;
  attempts: number;
}

export class AuditQueueService {
  private queue: QueuedEvent[] = [];
  private client: AuditServiceClient;
  private maxAttempts = 3;
  private processingQueue = false;
  private storageKey = 'audit_event_queue';
  
  constructor() {
    this.client = new AuditServiceClient();
    this.loadQueueFromStorage();
    this.processQueue();
    
    // Listen for online status to process queue when connection is restored
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }
  
  async createEvent(params: AuditEventCreateParams): Promise<void> {
    // Add to queue
    this.queue.push({
      params,
      timestamp: Date.now(),
      attempts: 0
    });
    
    this.saveQueueToStorage();
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      const event = this.queue[0];
      
      try {
        await this.client.createEvent(event.params);
        // Success, remove from queue
        this.queue.shift();
        this.saveQueueToStorage();
      } catch (error) {
        // Update attempts
        event.attempts++;
        
        if (event.attempts >= this.maxAttempts) {
          // Remove after max attempts
          this.queue.shift();
          console.error('Failed to send audit event after max attempts:', event);
        }
        
        this.saveQueueToStorage();
      }
    } finally {
      this.processingQueue = false;
      
      // Continue processing if more items in queue
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }
  
  private saveQueueToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    }
  }
  
  private loadQueueFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        try {
          this.queue = JSON.parse(stored);
        } catch (e) {
          this.queue = [];
        }
      }
    }
  }
}

// Create singleton instance
export const auditQueue = new AuditQueueService();
```

3. **React Hook for Components**

Create a React hook for easy audit logging in `hooks/use-audit-log.ts`:

```typescript
import { useCallback } from 'react';
import { auditQueue } from '@/lib/services/audit-queue-service';
import { AuditServiceClient } from '@/lib/services/audit-service-client';
import { AuditEvent, AuditEventCreateParams, AuditResponse } from '@/types';

export function useAuditLog(sessionId: string) {
  const client = new AuditServiceClient();
  
  const logEvent = useCallback((
    type: string,
    details: Record<string, any>
  ) => {
    const params: AuditEventCreateParams = {
      sessionId,
      type,
      details
    };
    
    return auditQueue.createEvent(params);
  }, [sessionId]);
  
  const getHistory = useCallback((
    limit = 20,
    offset = 0,
    types?: string[],
    shareToken?: string
  ): Promise<AuditResponse> => {
    return client.getSessionHistory(sessionId, limit, offset, types, shareToken);
  }, [client, sessionId]);
  
  return {
    logEvent,
    getHistory
  };
}
```

4. **Usage in Components**

Example usage in a text editor component:

```typescript
import { useAuditLog } from '@/hooks/use-audit-log';

// In your component
const { logEvent } = useAuditLog(sessionId);

const handleTextSave = async (shapeId: string, newText: string, previousText: string) => {
  // Save to database
  await saveTextToDatabase(shapeId, newText);
  
  // Log the event
  await logEvent('text_edit', {
    slideId: currentSlide.id,
    shapeId,
    previousText,
    newText
  });
};
```

### Server-Side Integration

For server components or route handlers, create a server-side client in `lib/services/audit-service-server.ts`:

```typescript
import { AuditEvent, AuditEventCreateParams, AuditResponse } from '@/types';

export class AuditServiceServer {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.AUDIT_SERVICE_URL || 'http://localhost:8080';
  }
  
  // Similar methods to the client-side implementation, but for server use
}
```

## Type Definitions

Define the necessary types in `types/index.ts`:

```typescript
// PPTX Processor Types
export interface ProcessingResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedTimeSeconds: number;
  sessionId: string;
  message: string;
}

export interface ProcessingStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  sessionId: string;
  slideCount?: number;
  message: string;
  completedAt?: string;
}

export interface ProcessedPresentation {
  sessionId: string;
  slideCount: number;
  slides: ProcessedSlide[];
}

export interface ProcessedSlide {
  slideId: string;
  slideNumber: number;
  svgUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  shapes: SlideShape[];
}

export interface SlideShape {
  shapeId: string;
  type: 'text' | 'image';
  originalText: string;
  translatedText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  styleData: {
    fontSize?: number;
    fontFamily?: string;
    isBold?: boolean;
    isItalic?: boolean;
    color?: string;
  };
}

// Audit Service Types
export interface AuditEventCreateParams {
  sessionId: string;
  type: string;
  details: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  sessionId: string;
  userId: string;
  type: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
```

## Testing the Integration

1. **Local Development**
   - Start all three services:
     - Next.js frontend: `npm run dev`
     - PPTX Processor: `python main.py`
     - Audit Service: `make run` (in audit-service directory)
   - Use the audit test page at `/audit-test` to test the Audit Service connection
   - Upload a test PPTX file to verify the PPTX Processor integration

2. **Production Configuration**
   - Update environment variables with production service URLs
   - Ensure CORS is properly configured on both microservices
   - Test the complete flow from upload to editing
   - Verify audit logs are being properly created and retrieved 