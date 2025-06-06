# Supabase Integration in Services

This document provides details about how each service in the PowerPoint Translator application integrates with Supabase.

## Overview

The PowerPoint Translator app uses several microservices, each with its own Supabase integration:

1. **Main Next.js App**: Frontend application using Supabase for auth, database, and storage
2. **PPTX Processor Service**: Python service for processing PowerPoint files
3. **Audit Service**: Go service for tracking user actions
4. **Share Service**: Node.js service for managing shared presentations
5. **Translation Session Service**: Node.js service for session management

## Main Next.js App

### Integration Details

The main application uses the Supabase JavaScript client with SSR support through the `@supabase/ssr` package:

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/database.types"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}

// Admin client for privileged operations
export async function createSupabaseAdminClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
          }
        },
      },
    },
  )
}
```

### Usage Patterns

- **Server Components**: Use `createSupabaseServerClient()` for data fetching and authenticated operations
- **Client Components**: Use `createClient()` for client-side operations
- **Admin Operations**: Use `createSupabaseAdminClient()` for operations requiring elevated privileges

### Authentication Flow

1. User signs in at `/auth/login`
2. Supabase handles authentication and redirects to `/auth/callback`
3. The callback route sets cookies and redirects to the dashboard
4. The app uses cookie-based session management for authenticated routes

## PPTX Processor Service

### Integration Details

The PPTX processor service uses the Python Supabase client to interact with the database and storage:

```python
# app/services/supabase_service.py
import os
import logging
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from app.core.config import get_settings

settings = get_settings()

def _create_supabase_client(supabase_url: Optional[str] = None, supabase_key: Optional[str] = None) -> Client:
    """
    Create a Supabase client with proper error handling.
    Uses the provided credentials or falls back to settings if not provided.
    """
    url = supabase_url or settings.SUPABASE_URL
    key = supabase_key or settings.SUPABASE_KEY

    if not url:
        raise ValueError("Supabase URL is not configured")
    if not key:
        raise ValueError("Supabase API key is not configured")

    # Clean and normalize credentials
    normalized_url = _normalize_supabase_url(url)
    
    try:
        return create_client(normalized_url, key)
    except Exception as e:
        logger.error(f"Error creating Supabase client: {str(e)}")
        raise Exception(f"Failed to create Supabase client: {str(e)}")
```

### Key Operations

The PPTX processor service performs these operations with Supabase:

1. **Upload Slide SVGs**:
   ```python
   async def upload_file_to_supabase(file_path: str, bucket: str, destination_path: str) -> str:
       """Upload a file to Supabase Storage and return the public URL."""
       supabase = _create_supabase_client()
       
       with open(file_path, "rb") as f:
           file_bytes = f.read()
           response = supabase.storage.from_(bucket).upload(destination_path, file_bytes)
       
       file_url = supabase.storage.from_(bucket).get_public_url(destination_path)
       return file_url
   ```

2. **Update Job Status**:
   ```python
   async def update_job_status(session_id: str, status: str, slide_count: Optional[int] = None,
                             result_url: Optional[str] = None, error: Optional[str] = None) -> None:
       """Update the status of a translation session in Supabase."""
       supabase = _create_supabase_client()
       
       data = {"status": status}
       if slide_count is not None:
           data["slide_count"] = slide_count
       if result_url:
           data["result_url"] = result_url
       if error:
           data["error"] = error
           
       response = supabase.table("translation_sessions").update(data).eq("id", session_id).execute()
   ```

3. **Save Slide Data**:
   ```python
   async def save_slide_data(session_id: str, slide_data: Dict[str, Any]) -> str:
       """Save slide data to Supabase and return the slide ID."""
       supabase = _create_supabase_client()
       
       # Prepare slide data with session ID
       data = {**slide_data, "session_id": session_id}
       
       # Insert slide data
       response = supabase.table("slides").insert(data).execute()
       slide_id = response.data[0]["id"]
       
       return slide_id
   ```

## Audit Service

### Integration Details

The Audit service uses a custom Go client to interact with Supabase:

```go
// internal/repository/supabase_client.go
package repository

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"

    "audit-service/internal/config"

    "go.uber.org/zap"
)

// SupabaseClient handles communication with Supabase REST API
type SupabaseClient struct {
    baseURL    string
    httpClient *http.Client
    headers    map[string]string
    logger     *zap.Logger
}

// NewSupabaseClient creates a new Supabase REST API client
func NewSupabaseClient(cfg *config.Config, logger *zap.Logger) *SupabaseClient {
    httpClient := &http.Client{
        Timeout: cfg.HTTPTimeout,
        Transport: &http.Transport{
            MaxIdleConns:        cfg.HTTPMaxIdleConns,
            MaxIdleConnsPerHost: cfg.HTTPMaxConnsPerHost,
            IdleConnTimeout:     cfg.HTTPIdleConnTimeout,
        },
    }

    return &SupabaseClient{
        baseURL:    fmt.Sprintf("%s/rest/v1", cfg.SupabaseURL),
        httpClient: httpClient,
        headers:    cfg.GetSupabaseHeaders(),
        logger:     logger,
    }
}
```

### Key Operations

The Audit service uses direct REST API calls to Supabase for:

1. **Audit Log Storage**: Recording user actions in a dedicated audit log table
2. **JWT Validation**: Validating user tokens for authenticated requests
3. **User Information**: Retrieving user details for audit context

## Share Service

### Integration Details

The Share service uses the TypeScript Supabase client:

```typescript
// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { createLogger } from './logger';

const logger = createLogger('supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Supabase URL or key not provided');
  throw new Error('Supabase URL and key must be provided');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Key Operations

The Share service handles:

1. **Creating Shares**:
   ```typescript
   export async function createShare(data: Omit<Share, 'id' | 'created_at' | 'updated_at'>) {
     try {
       const { data: share, error } = await supabase
         .from('session_shares')
         .insert(data)
         .select()
         .single();

       if (error) {
         logger.error({ error }, 'Error creating share');
         throw error;
       }

       return share;
     } catch (error) {
       logger.error({ error }, 'Error in createShare');
       throw error;
     }
   }
   ```

2. **Retrieving Shares**:
   ```typescript
   export async function getShareByToken(token: string) {
     try {
       const { data: share, error } = await supabase
         .from('session_shares')
         .select('*')
         .eq('share_token', token)
         .single();

       if (error) {
         logger.error({ error }, 'Error getting share by token');
         throw error;
       }

       return share;
     } catch (error) {
       logger.error({ error }, 'Error in getShareByToken');
       throw error;
     }
   }
   ```

## Translation Session Service

### Integration Details

The Translation Session service also uses the TypeScript Supabase client similar to the Share service.

### Key Operations

The service handles:

1. **Session CRUD Operations**: Creating, reading, updating, and deleting translation sessions
2. **User Verification**: Ensuring users have access to the sessions they request
3. **Session Metadata**: Managing session properties and status

## Best Practices

For all services integrating with Supabase:

1. **Error Handling**: All services implement comprehensive error handling for Supabase operations
2. **Logging**: Detailed logging for debugging and monitoring
3. **Credential Management**: Secure handling of API keys and credentials
4. **Connection Pooling**: Efficient management of database connections
5. **Retries**: Implementing retry logic for transient failures
6. **Type Safety**: Using generated types from the database schema

## Environment Variables

Each service requires these environment variables for Supabase integration:

```
# Main Next.js App
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PPTX Processor Service
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-service-role-key

# Audit Service
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Share Service
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Translation Session Service
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
``` 