import { SharePermission, CreatedShareInfo, ShareRecord, ValidatedShareToken } from '@/types/share';
import { fetchWithAuthAndCors, fetchWithCors } from './api-utils';

const SHARE_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_SHARE_SERVICE_URL || 'http://localhost:3004/api/v1/shares';

/**
 * Creates a new share for a presentation session.
 * @param sessionId The ID of the presentation session to share.
 * @param expiresIn Optional duration string for how long the share should last. Default follows service config.
 * @param permission Access level to grant (view or edit).
 * @returns The newly created share information.
 */
export async function createShare(
  sessionId: string,
  expiresIn?: string,
  permission: SharePermission = SharePermission.VIEW
): Promise<CreatedShareInfo> {
  const payload = {
    session_id: sessionId,
    permission,
    ...(expiresIn ? { expires_in: expiresIn } : {})
  };

  const tokenString = localStorage.getItem('supabase.auth.token');
  let token = '';

  if (tokenString) {
    try {
      const parsedToken = JSON.parse(tokenString);
      if (parsedToken && parsedToken.access_token) {
        token = parsedToken.access_token;
      }
    } catch (e) {
      console.error('Failed to parse auth token from localStorage', e);
    }
  }

  if (!token) {
    throw new Error('Authentication required to create shares');
  }

  const response = await fetchWithAuthAndCors(`${SHARE_SERVICE_BASE_URL}`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status: ${response.status} and no JSON body` };
    }
    throw new Error(errorData.message || `HTTP error ${response.status}`);
  }
  return response.json();
}

/**
 * Retrieves a list of all shares created by the current user.
 * @returns An array of ShareRecord objects.
 */
export async function getMyShares(): Promise<ShareRecord[]> {
  const tokenString = localStorage.getItem('supabase.auth.token');
  let token = '';

  if (tokenString) {
    try {
      const parsedToken = JSON.parse(tokenString);
      if (parsedToken && parsedToken.access_token) {
        token = parsedToken.access_token;
      }
    } catch (e) {
      console.error('Failed to parse auth token from localStorage', e);
    }
  }

  if (!token) {
    throw new Error('Authentication required to list shares');
  }

  const response = await fetchWithAuthAndCors(`${SHARE_SERVICE_BASE_URL}/my`, token, {});

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status: ${response.status} and no JSON body` };
    }
    throw new Error(errorData.message || `HTTP error ${response.status}`);
  }
  return response.json();
}

/**
 * Validates a share token.
 * This endpoint is public and does not require auth in the same way.
 * @param token The share token string.
 * @returns An object indicating if the token is valid, and the payload (ShareRecord) if valid.
 */
export async function validateShareToken(token: string): Promise<ValidatedShareToken> {
  const url = `${SHARE_SERVICE_BASE_URL}/validate/${token}`;
  const response = await fetchWithCors(url, {
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

/**
 * Deletes a share by token or ID.
 * @param idOrToken The share ID or token to delete.
 * @returns True if the share was successfully deleted.
 */
export async function deleteShare(idOrToken: string): Promise<boolean> {
  const tokenString = localStorage.getItem('supabase.auth.token');
  let token = '';

  if (tokenString) {
    try {
      const parsedToken = JSON.parse(tokenString);
      if (parsedToken && parsedToken.access_token) {
        token = parsedToken.access_token;
      }
    } catch (e) {
      console.error('Failed to parse auth token from localStorage', e);
    }
  }

  if (!token) {
    throw new Error('Authentication required to delete shares');
  }

  // Determine if we're dealing with a token or an ID (tokens are typically longer)
  const endpoint = idOrToken.length > 20 
    ? `${SHARE_SERVICE_BASE_URL}/token/${idOrToken}`
    : `${SHARE_SERVICE_BASE_URL}/${idOrToken}`;

  const response = await fetchWithAuthAndCors(endpoint, token, {
    method: 'DELETE',
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status: ${response.status} and no JSON body` };
    }
    throw new Error(errorData.message || `HTTP error ${response.status}`);
  }
  return true;
} 