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

/**
 * Service for queuing and reliably sending audit events
 * Handles offline scenarios and retries failed submissions
 */
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
        console.error('Failed to send audit event:', error);
        
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
    try {
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
  
  // Initialize queue from localStorage
  public initializeForSession(sessionId: string): void {
    this.loadQueue(sessionId);
  }
} 