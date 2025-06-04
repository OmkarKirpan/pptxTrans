# Audit Service Integration Documentation

## Overview
The Audit Service is a Go microservice that provides audit logging capabilities for tracking user activities within translation sessions. This document outlines how to integrate with the service.

## Base URL
- Development: `http://localhost:4006`
- Production: `https://audit-service.pptxtrans.com` (placeholder - update with actual URL)

## Authentication
The service supports two authentication methods:

### 1. JWT Authentication
- Include the Supabase JWT token in the `Authorization` header
- Format: `Bearer <token>`
- All standard user operations require this authentication
- The JWT token is validated against the Supabase JWT secret

### 2. Share Token Authentication
- For limited access scenarios (reviewers)
- Include in query parameter: `?share_token=<share_token>`
- Only grants access to specific sessions based on token permissions
- Share tokens are validated against the `session_shares` table in Supabase

## API Endpoints

### 1. Create Audit Event
```
POST /api/v1/events
```

#### Request Body
```json
{
  "sessionId": "session-123",
  "type": "edit",
  "details": {
    "slideId": "slide-456",
    "shapeId": "shape-789",
    "previousText": "Original text",
    "newText": "Translated text"
  }
}
```

#### Response (201 Created)
```json
{
  "id": "evt-abc123",
  "sessionId": "session-123",
  "userId": "user-456",
  "type": "edit",
  "timestamp": "2023-06-15T14:30:00Z",
  "success": true
}
```

### 2. Retrieve Session History
```
GET /api/v1/sessions/{sessionId}/history
```

#### Query Parameters
- `limit`: Maximum number of events to return (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)
- `share_token`: Optional share token for reviewer access

#### Response (200 OK)
```json
{
  "totalCount": 157,
  "items": [
    {
      "id": "evt-abc123",
      "sessionId": "session-123",
      "userId": "user-456",
      "type": "edit",
      "details": { ... },
      "timestamp": "2023-06-15T14:30:00Z",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0..."
    },
    ...
  ]
}
```

### 3. Health Check
```
GET /health
```

#### Response (200 OK)
```json
{
  "status": "healthy",
  "service": "audit-service",
  "version": "1.0.0",
  "time": "2023-06-15T14:30:00Z"
}
```

## Error Handling
All endpoints return standard HTTP status codes:
- 200: Success
- 400: Bad request (invalid parameters)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (insufficient permissions)
- 404: Resource not found
- 500: Internal server error

Error responses follow this format:
```json
{
  "error": "invalid_session_id",
  "message": "The provided session ID is invalid"
}
```

## Test Session Support

The Audit Service provides special support for test sessions to facilitate development and testing:

- **Test Session IDs:** Use session IDs with prefix "test-" (e.g., "test-123")
- **Authentication Bypass:** Token validation is relaxed for test sessions
- **In-Memory Storage:** Test events are stored in memory rather than in the database
- **Isolated Environment:** Test data doesn't affect production data

Example test session ID usage:
```json
{
  "sessionId": "test-my-session",
  "type": "edit",
  "details": { "testData": true }
}
```

## Frontend Integration

The frontend uses two primary classes and a React hook to interact with the Audit Service.

### 1. AuditServiceClient

The `AuditServiceClient` class handles direct communication with the Audit Service API.

File: `lib/api/audit-service.ts`

```typescript
import { AuditEntry, AuditResponse, AuditAction } from '@/types/audit';

const AUDIT_SERVICE_URL = process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://localhost:4006';

export class AuditServiceClient {
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  /**
   * Fetch audit history for a specific session
   */
  async getSessionHistory(
    sessionId: string, 
    page = 1, 
    limit = 50
  ): Promise<AuditResponse> {
    const offset = (page - 1) * limit;
    try {
      const response = await fetch(
        `${AUDIT_SERVICE_URL}/api/v1/sessions/${sessionId}/history?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        // Handle error status codes
        if (response.status === 401) {
          throw new Error('Authentication failed: Invalid or expired token');
        } else if (response.status === 403) {
          throw new Error('Access denied: You do not have permission to view this session');
        } else if (response.status === 404) {
          throw new Error('Session not found');
        } else if (response.status === 503) {
          throw new Error('Audit service is currently unavailable');
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to fetch audit logs');
        }
      }
      
      return response.json();
    } catch (error) {
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }

  /**
   * Create a new audit event
   */
  async createAuditEvent(
    sessionId: string,
    type: AuditAction,
    details?: any
  ): Promise<void> {
    try {
      const response = await fetch(
        `${AUDIT_SERVICE_URL}/api/v1/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            type,
            details,
            timestamp: new Date().toISOString(),
          }),
        }
      );
      
      if (!response.ok) {
        // Handle error status codes
        const error = await response.json();
        throw new Error(error.message || 'Failed to create audit event');
      }
    } catch (error) {
      throw error;
    }
  }
}
```

### 2. AuditQueueService

The `AuditQueueService` provides a reliable queue system for audit events, including offline support and retry logic.

File: `lib/services/audit-queue.ts`

```typescript
import { AuditAction } from '@/types/audit';

interface AuditEventPayload {
  sessionId: string;
  type: AuditAction;
  details?: any;
}

interface QueuedAuditEvent extends AuditEventPayload {
  timestamp: number;
  retryCount: number;
}

export class AuditQueueService {
  private static instance: AuditQueueService;
  private queue: QueuedAuditEvent[] = [];
  private processing = false;
  private maxRetries = 3;
  private auditServiceUrl = process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://localhost:4006';
  
  private constructor() {
    // Private constructor for singleton pattern
  }
  
  // Create queue key based on sessionId to store in localStorage
  private getQueueKey(sessionId: string): string {
    return `audit_queue_${sessionId}`;
  }
  
  // Load queue from localStorage
  private loadQueue(sessionId: string): void {
    try {
      const savedQueue = localStorage.getItem(this.getQueueKey(sessionId));
      if (savedQueue) {
        const parsedQueue = JSON.parse(savedQueue);
        // Only add events for the current session
        this.queue = [
          ...this.queue,
          ...parsedQueue.filter((event: QueuedAuditEvent) => event.sessionId === sessionId)
        ];
      }
    } catch (error) {
      console.error('Failed to load audit queue from localStorage:', error);
    }
  }
  
  // Save queue to localStorage
  private saveQueue(sessionId: string): void {
    try {
      localStorage.setItem(this.getQueueKey(sessionId), JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save audit queue to localStorage:', error);
    }
  }
  
  // Get singleton instance
  public static getInstance(): AuditQueueService {
    if (!AuditQueueService.instance) {
      AuditQueueService.instance = new AuditQueueService();
    }
    return AuditQueueService.instance;
  }
  
  // Add event to the queue
  public enqueueEvent(event: AuditEventPayload, token: string): void {
    const queuedEvent: QueuedAuditEvent = {
      ...event,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.queue.push(queuedEvent);
    this.saveQueue(event.sessionId);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue(token);
    }
  }
  
  // Process the queue
  private async processQueue(token: string): Promise<void> {
    if (this.queue.length === 0 || this.processing) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const event = this.queue[0];
      
      try {
        await this.sendAuditEvent(event, token);
        
        // Remove the successfully processed event
        this.queue.shift();
        this.saveQueue(event.sessionId);
      } catch (error) {
        // Increment retry count
        event.retryCount++;
        
        if (event.retryCount > this.maxRetries) {
          // Remove event if max retries exceeded
          this.queue.shift();
        } else {
          // Move to the end of the queue for retry
          this.queue.shift();
          this.queue.push(event);
        }
        
        this.saveQueue(event.sessionId);
        
        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    this.processing = false;
  }
  
  // Send audit event to the service
  private async sendAuditEvent(event: QueuedAuditEvent, token: string): Promise<void> {
    const response = await fetch(`${this.auditServiceUrl}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: event.sessionId,
        type: event.type,
        details: event.details,
        timestamp: new Date(event.timestamp).toISOString(),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send audit event: ${response.statusText}`);
    }
  }
  
  // Initialize queue from localStorage
  public initializeForSession(sessionId: string): void {
    this.loadQueue(sessionId);
  }
}
```

### 3. useAuditLog React Hook

The `useAuditLog` hook provides an easy-to-use interface for React components to interact with the Audit Service.

File: `hooks/useAuditLog.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { AuditServiceClient } from '@/lib/api/audit-service';
import { AuditQueueService } from '@/lib/services/audit-queue';
import { AuditAction, AuditEntry, AuditResponse } from '@/types/audit';
import { createClient } from '@/lib/supabase/client';

export function useAuditLog(sessionId: string) {
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const pageSize = 50;

  // Initialize queue and token
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get user session token
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token || null;
        setToken(accessToken);

        if (accessToken && sessionId) {
          // Initialize audit queue for this session
          const queueService = AuditQueueService.getInstance();
          queueService.initializeForSession(sessionId);
        }
      } catch (err) {
        console.error('Failed to initialize audit log:', err);
        setError('Failed to initialize audit logging');
      }
    };

    initialize();
  }, [sessionId, supabase.auth]);

  // Load audit logs
  const loadAuditLogs = useCallback(async (page: number = 1) => {
    if (!token || !sessionId) {
      setError('Authentication required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const auditClient = new AuditServiceClient(token);
      const response: AuditResponse = await auditClient.getSessionHistory(
        sessionId,
        page,
        pageSize
      );
      
      setAuditLogs(response.items);
      setTotalCount(response.totalCount);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Failed to load audit history');
      toast({
        title: 'Error',
        description: 'Failed to load audit logs. You can continue working.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, token, toast]);

  // Create audit event
  const createAuditEvent = useCallback((
    type: AuditAction,
    details?: any
  ) => {
    if (!token || !sessionId) {
      console.error('Cannot create audit event: Missing token or sessionId');
      return;
    }

    try {
      const queueService = AuditQueueService.getInstance();
      queueService.enqueueEvent(
        {
          sessionId,
          type,
          details,
        },
        token
      );
    } catch (err) {
      console.error('Failed to create audit event:', err);
      // We don't show UI errors for audit event creation failures
      // as specified in the requirements (fail gracefully)
    }
  }, [sessionId, token]);

  return {
    auditLogs,
    isLoading,
    error,
    totalCount,
    currentPage,
    pageSize,
    goToPage: loadAuditLogs,
    createAuditEvent,
    refresh: () => loadAuditLogs(currentPage),
  };
}
```

### 4. Implementation Example

The following example shows how to use the `useAuditLog` hook in a component:

```tsx
'use client';

import { useEffect } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Button } from '@/components/ui/button';

export function SlideEditor({ sessionId, slideId }: { sessionId: string, slideId: string }) {
  const { createAuditEvent } = useAuditLog(sessionId);
  
  const handleTextEdit = (textId: string, newText: string, oldText: string) => {
    // Perform text edit logic
    
    // Log the edit action
    createAuditEvent('edit', {
      slideId,
      textId,
      previousText: oldText,
      newText
    });
  };
  
  const handleExport = () => {
    // Export logic
    
    // Log the export action
    createAuditEvent('export', {
      format: 'pptx',
      slideCount: 10
    });
  };
  
  return (
    <div>
      {/* Editor UI */}
      <Button onClick={handleExport}>Export Presentation</Button>
    </div>
  );
}
```

### 5. Audit Log Display Example

This example shows how to display audit logs:

```tsx
'use client';

import { useEffect } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { formatDistanceToNow } from 'date-fns';

export function AuditLogViewer({ sessionId }: { sessionId: string }) {
  const { 
    auditLogs, 
    isLoading, 
    totalCount, 
    currentPage, 
    pageSize, 
    goToPage, 
    refresh 
  } = useAuditLog(sessionId);
  
  useEffect(() => {
    // Load logs when component mounts
    refresh();
  }, []);
  
  if (isLoading) {
    return <div>Loading audit logs...</div>;
  }
  
  return (
    <div>
      <h2>Audit History</h2>
      
      {auditLogs.length === 0 ? (
        <div>No audit records found</div>
      ) : (
        <>
          {auditLogs.map(log => (
            <Card key={log.id}>
              <CardContent>
                <div><strong>Action:</strong> {log.type}</div>
                <div><strong>User:</strong> {log.userId}</div>
                <div><strong>Time:</strong> {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</div>
                {log.details && (
                  <pre>{JSON.stringify(log.details, null, 2)}</pre>
                )}
              </CardContent>
            </Card>
          ))}
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1} 
                />
              </PaginationItem>
              {/* Page number items here */}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage * pageSize >= totalCount} 
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  );
}
```

## AuditAction Types

The following action types are supported in the `AuditAction` type:

```typescript
export type AuditAction = 
  | 'create' 
  | 'edit' 
  | 'merge' 
  | 'reorder' 
  | 'comment'
  | 'export' 
  | 'share' 
  | 'unshare' 
  | 'view';
```

Use these action types when creating audit events for consistency.

## Configuration
Environment variables required for integration:
- `NEXT_PUBLIC_AUDIT_SERVICE_URL`: Base URL of the Audit Service (default: 'http://localhost:4006')
- `SUPABASE_JWT_SECRET`: Shared secret for JWT validation (server-side only)

## Docker Deployment
The Audit Service can be deployed using Docker. Environment variables can be passed as shown in the example below:

```yaml
version: "3.8"
services:
  audit-service:
    image: pptxtrans/audit-service:latest
    ports:
      - "4006:4006"
    environment:
      - PORT=4006
      - LOG_LEVEL=info
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - CORS_ORIGIN=http://localhost:3000
      - CACHE_JWT_TTL=5m
      - CACHE_SHARE_TOKEN_TTL=1m
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:4006/health"]
      interval: 30s
      timeout: 10s
      retries: 3 