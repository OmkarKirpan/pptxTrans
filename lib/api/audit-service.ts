import { AuditEntry, AuditResponse, AuditAction } from '@/types/audit';
import { fetchWithAuthAndCors } from './api-utils';

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
      const response = await fetchWithAuthAndCors(
        `${AUDIT_SERVICE_URL}/api/v1/sessions/${sessionId}/history?limit=${limit}&offset=${offset}`,
        this.token,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        // Handle specific error status codes
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
      // Check for network-related errors (service unavailable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Audit service is unreachable');
        throw new Error('Audit service is unreachable');
      }
      
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
      const response = await fetchWithAuthAndCors(
        `${AUDIT_SERVICE_URL}/api/v1/events`,
        this.token,
        {
          method: 'POST',
          headers: {
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
        // Handle specific error status codes
        if (response.status === 401) {
          throw new Error('Authentication failed: Invalid or expired token');
        } else if (response.status === 400) {
          const error = await response.json();
          throw new Error(`Invalid request: ${error.message || 'Bad request'}`);
        } else if (response.status === 404) {
          throw new Error('Audit service endpoint not found');
        } else if (response.status === 503) {
          throw new Error('Audit service is currently unavailable');
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create audit event');
        }
      }
    } catch (error) {
      // Check for network-related errors (service unavailable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Audit service is unreachable');
        throw new Error('Audit service is unreachable');
      }
      
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }
} 