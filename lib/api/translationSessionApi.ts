/**
 * API client for interacting with the TranslationSessionService
 */
import { createClient } from '@/lib/supabase/client'
import type {
  TranslationSession,
  CreateSessionPayload,
  UpdateSessionPayload,
  PaginatedSessions
} from '@/types/api'; // Define these types in your Next.js project, matching service models

/**
 * Gets the Supabase authentication token
 */
async function getSupabaseToken() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// Base URL for the TranslationSessionService API
const SERVICE_ROOT_URL = process.env.NEXT_PUBLIC_TRANSLATION_SESSION_SERVICE_URL || ''; // Defaults to relative path if not set
const API_BASE_URL = `${SERVICE_ROOT_URL}/api/v1/sessions`; // Consistently point to the versioned endpoint

/**
 * Creates a new translation session
 */
export async function createSession(payload: CreateSessionPayload): Promise<TranslationSession | null> {
  const token = await getSupabaseToken()
  
  if (!token) {
    throw new Error('Authentication required')
  }
  
  const response = await fetch(`${API_BASE_URL}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to create session: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Gets a list of translation sessions for the current user
 * @param options Query parameters like status, sortBy, page, limit
 */
export async function listSessions(options?: {
  status?: string
  sortBy?: string
  page?: number
  limit?: number
}): Promise<PaginatedSessions | TranslationSession[]> {
  const token = await getSupabaseToken()
  
  if (!token) {
    throw new Error('Authentication required')
  }
  
  // Build query string from options
  const queryParams = new URLSearchParams()
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value))
      }
    })
  }
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''
  
  const response = await fetch(`${API_BASE_URL}/${queryString}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to list sessions: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Gets details for a specific translation session
 */
export async function getSessionById(sessionId: string): Promise<TranslationSession> {
  const token = await getSupabaseToken()
  
  if (!token) {
    throw new Error('Authentication required')
  }
  
  const response = await fetch(`${API_BASE_URL}/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to get session: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Updates a translation session
 */
export async function updateSession(sessionId: string, payload: UpdateSessionPayload): Promise<TranslationSession> {
  const token = await getSupabaseToken()
  
  if (!token) {
    throw new Error('Authentication required')
  }
  
  const response = await fetch(`${API_BASE_URL}/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to update session: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Deletes a translation session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const token = await getSupabaseToken()
  
  if (!token) {
    throw new Error('Authentication required')
  }
  
  const response = await fetch(`${API_BASE_URL}/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to delete session: ${response.status}`)
  }
}

/**
 * Updates the last_opened_at timestamp for a session (used when opening editor)
 */
export async function updateLastOpenedAt(sessionId: string): Promise<TranslationSession> {
  return updateSession(sessionId, {
    last_opened_at: new Date().toISOString()
  })
}

// Reminder: Define these types in your Next.js project (e.g., types/api/index.ts)
// to mirror the service's models:
// export interface TranslationSession { id: string; user_id: string; session_name: string; ...etc }
// export interface CreateSessionPayload { session_name: string; ...etc }
// export interface UpdateSessionPayload { session_name?: string; ...etc }
// export interface PaginatedSessions { items: TranslationSession[]; total: number; page: number; limit: number; totalPages: number; } 