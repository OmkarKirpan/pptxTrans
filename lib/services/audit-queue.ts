import { AuditAction } from '@/types/audit';
import { fetchWithAuthAndCors } from '../api/api-utils';

// Queue item structure
interface QueuedAuditEvent {
  sessionId: string;
  type: AuditAction;
  details?: any;
  timestamp: number;
  retryCount: number;
}

// Constants
const QUEUE_KEY_PREFIX = 'auditQueue_';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 3;
const RETRY_INTERVAL = 30000; // 30 seconds

/**
 * Service for queuing and reliably sending audit events
 * Handles offline scenarios and retries failed submissions
 */
export class AuditQueueService {
  private static instance: AuditQueueService;
  private initialized: boolean = false;
  private processingQueue: boolean = false;
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private currentSessionId: string | null = null;
  private auditServiceUrl: string;
  
  private constructor() {
    this.auditServiceUrl = process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://localhost:4006';
  }
  
  // Singleton pattern
  public static getInstance(): AuditQueueService {
    if (!AuditQueueService.instance) {
      AuditQueueService.instance = new AuditQueueService();
    }
    return AuditQueueService.instance;
  }
  
  // Initialize the queue for a specific session
  public initializeForSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.initialized = true;
    this.loadQueue(sessionId);
    this.processQueue();
  }
  
  // Add a new audit event to the queue
  public enqueueAuditEvent(
    type: AuditAction,
    details?: any
  ): void {
    if (!this.initialized || !this.currentSessionId) {
      console.error('Audit queue not initialized. Call initializeForSession first.');
      return;
    }
    
    const sessionId = this.currentSessionId;
    const event: QueuedAuditEvent = {
      sessionId,
      type,
      details,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.addToQueue(sessionId, event);
    
    if (!this.processingQueue) {
      this.processQueue();
    }
  }
  
  // Load the queue from localStorage
  private loadQueue(sessionId: string): QueuedAuditEvent[] {
    try {
      const queueString = localStorage.getItem(`${QUEUE_KEY_PREFIX}${sessionId}`);
      if (queueString) {
        return JSON.parse(queueString);
      }
    } catch (error) {
      console.error('Error loading audit queue from localStorage:', error);
    }
    return [];
  }
  
  // Save the queue to localStorage
  private saveQueue(sessionId: string, queue: QueuedAuditEvent[]): void {
    try {
      localStorage.setItem(`${QUEUE_KEY_PREFIX}${sessionId}`, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving audit queue to localStorage:', error);
    }
  }
  
  // Add an event to the queue
  private addToQueue(sessionId: string, event: QueuedAuditEvent): void {
    const queue = this.loadQueue(sessionId);
    
    // Ensure queue doesn't exceed max size
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest events
      queue.splice(0, queue.length - MAX_QUEUE_SIZE + 1);
    }
    
    queue.push(event);
    this.saveQueue(sessionId, queue);
  }
  
  // Process events in the queue
  private async processQueue(): Promise<void> {
    if (!this.initialized || !this.currentSessionId || this.processingQueue) {
      return;
    }
    
    this.processingQueue = true;
    const sessionId = this.currentSessionId;
    const queue = this.loadQueue(sessionId);
    
    if (queue.length === 0) {
      this.processingQueue = false;
      return;
    }
    
    try {
      // Get token for authentication
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
          this.scheduleRetry();
          return;
        }
      }
      
      if (!token) {
        console.error('No authentication token available for audit events');
        this.scheduleRetry();
        return;
      }
      
      // Process events in the queue
      const event = queue[0];
      await this.sendAuditEvent(event, token);
      
      // Remove the event from the queue on success
      queue.shift();
      this.saveQueue(sessionId, queue);
      
      // Continue processing queue if there are more events
      if (queue.length > 0) {
        setTimeout(() => {
          this.processingQueue = false;
          this.processQueue();
        }, 100);
      } else {
        this.processingQueue = false;
      }
    } catch (error) {
      // Handle failures
      const event = queue[0];
      event.retryCount++;
      
      if (event.retryCount > MAX_RETRY_COUNT) {
        // Remove events that have exceeded retry count
        queue.shift();
      }
      
      this.saveQueue(sessionId, queue);
      this.scheduleRetry();
    }
  }
  
  // Schedule a retry after the retry interval
  private scheduleRetry(): void {
    this.processingQueue = false;
    
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    this.retryTimeoutId = setTimeout(() => {
      this.processQueue();
    }, RETRY_INTERVAL);
  }
  
  // Send audit event to the service
  private async sendAuditEvent(event: QueuedAuditEvent, token: string): Promise<void> {
    try {
      const response = await fetchWithAuthAndCors(
        `${this.auditServiceUrl}/api/v1/events`, 
        token,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: event.sessionId,
            type: event.type,
            details: event.details,
            timestamp: new Date(event.timestamp).toISOString(),
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
          throw new Error(`Failed to send audit event: ${response.statusText}`);
        }
      }
    } catch (error) {
      // Check for network-related errors (service unavailable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Audit service is unreachable. Event will be retried later.');
        throw new Error('Audit service is unreachable. Event will be retried later.');
      }
      
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }
} 