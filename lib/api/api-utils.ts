/**
 * Utility functions for making API calls with proper CORS headers
 */

/**
 * Creates fetch headers with proper CORS and authorization settings
 * @param token Optional authentication token
 * @param contentType Content type header (defaults to application/json)
 * @returns Headers object with all necessary headers
 */
export function createApiHeaders(
  token?: string | null,
  contentType: string = 'application/json'
): Headers {
  const headers = new Headers();
  
  // Set content type
  headers.set('Content-Type', contentType);
  
  // Set CORS mode explicitly
  headers.set('Mode', 'cors');
  
  // Add authorization if token is provided
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return headers;
}

/**
 * Wrapper around fetch that includes proper CORS configuration
 * @param url URL to fetch
 * @param options Fetch options
 * @returns Fetch response
 */
export async function fetchWithCors(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Ensure CORS mode is set
  options = {
    ...options,
    mode: 'cors', // Explicitly set CORS mode
    credentials: 'include' // Include credentials for cross-origin requests if needed
  };
  
  return fetch(url, options);
}

/**
 * Wrapper around fetch that includes authorization and CORS configuration
 * @param url URL to fetch
 * @param token Authentication token
 * @param options Fetch options
 * @returns Fetch response
 */
export async function fetchWithAuthAndCors(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  // Create headers with auth token
  const headers = createApiHeaders(token);
  
  // Add any existing headers from options
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  
  // Add CORS mode and credentials with headers
  const updatedOptions: RequestInit = {
    ...options,
    headers,
    mode: 'cors',
    credentials: 'include'
  };
  
  return fetch(url, updatedOptions);
} 