import { SharePermission, CreatedShareInfo, ShareRecord, ValidatedShareToken } from '@/types/share'; // Assuming types will be in @/types

const SHARE_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_SHARE_SERVICE_URL || 'http://localhost:3004/api/v1/shares'; // Matching controller path

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const tokenString = localStorage.getItem('supabase.auth.token');

  // Start with headers from options, then add/override
  const requestHeaders: HeadersInit = new Headers(options.headers || {});

  // Ensure Content-Type is set, default to application/json if not present
  if (!requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (tokenString) {
    try {
      const token = JSON.parse(tokenString);
      if (token && token.access_token) {
        requestHeaders.set('Authorization', `Bearer ${token.access_token}`);
      }
    } catch (e) {
      console.error('Failed to parse auth token from localStorage', e);
    }
  }

  const response = await fetch(url, { ...options, headers: requestHeaders });

  if (!response.ok) {
    let errorData;
    try {
        errorData = await response.json();
    } catch {
        errorData = { message: `Request failed with status: ${response.status} and no JSON body` };
    }
    throw new Error(errorData.message || `HTTP error ${response.status}`);
  }
  return response;
}

/**
 * Creates a new share token for a session.
 * @param sessionId The ID of the session.
 * @param permissions Array of permissions for the share.
 * @param expiresIn Optional duration string (e.g., '7d', '1h').
 * @param name Optional user-friendly name for the share link.
 * @returns Information about the created share, including the share URL.
 */
export async function createShareToken(
  sessionId: string,
  permissions: SharePermission[],
  expiresIn?: string,
  name?: string
): Promise<CreatedShareInfo> {
  const response = await fetchWithAuth(`${SHARE_SERVICE_BASE_URL}/sessions/${sessionId}/shares`, {
    method: 'POST',
    body: JSON.stringify({ permissions, expiresIn, name }),
  });
  return response.json();
}

/**
 * Lists all active share tokens for a given session.
 * @param sessionId The ID of the session.
 * @returns An array of share records.
 */
export async function listShareTokens(sessionId: string): Promise<ShareRecord[]> {
  const response = await fetchWithAuth(`${SHARE_SERVICE_BASE_URL}/sessions/${sessionId}/shares`, {
    method: 'GET',
  });
  return response.json();
}

/**
 * Revokes a share token.
 * @param shareTokenJti The JTI of the share token to revoke.
 * @returns A confirmation message.
 */
export async function revokeShareToken(shareTokenJti: string): Promise<{ message: string; data?: ShareRecord }> {
  const response = await fetchWithAuth(`${SHARE_SERVICE_BASE_URL}/shares/${shareTokenJti}`, {
    method: 'DELETE',
  });
  return response.json();
}

/**
 * Validates a share token.
 * This endpoint is public and does not require auth in the same way, but fetchWithAuth can be used if it gracefully handles no token.
 * Or, use a separate fetch function if no Authorization header should be sent.
 * @param token The share token string.
 * @returns An object indicating if the token is valid, and the payload (ShareRecord) if valid.
 */
export async function validateShareToken(token: string): Promise<ValidatedShareToken> {
  // For public endpoint, we might not need/want to send Authorization header from a logged-in user.
  // Using a direct fetch or a modified fetchWithAuth that can omit Authorization.
  const url = `${SHARE_SERVICE_BASE_URL}/validate/${token}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
    }
  });
  
  if (!response.ok) {
    let errorPayload: Partial<ValidatedShareToken> = { valid: false };
    try {
        const errorData = await response.json();
        errorPayload.message = errorData.message || `Token validation failed: ${response.status}`;
        // If the backend returns a payload with error details, capture it if needed
        if (errorData.payload) errorPayload.payload = errorData.payload;
    } catch {
        errorPayload.message = `Token validation failed: ${response.status} and no JSON body`;
    }
    // For validate, specific statuses often mean specific outcomes rather than app-breaking errors.
    if (response.status === 401 || response.status === 400 || response.status === 404) {
        return errorPayload as ValidatedShareToken; 
    }
    // For other errors (e.g., 500), throw an actual error.
    throw new Error(errorPayload.message || `HTTP error ${response.status}`);
  }
  // If response.ok is true, the backend should return { valid: true, payload: ShareRecord }
  return response.json(); 
} 