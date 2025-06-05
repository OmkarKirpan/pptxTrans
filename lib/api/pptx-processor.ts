import { ProcessingResponse } from '@/types/pptx-processor';

const PPTX_PROCESSOR_URL = process.env.NEXT_PUBLIC_PPTX_PROCESSOR_URL || 'http://localhost:8000';

export class PptxProcessorClient {
  private token: string;
  
  constructor(token: string = '') {
    this.token = token;
  }
  
  /**
   * Process a PPTX file
   */
  async processPptx(
    file: File,
    sessionId: string,
    sourceLanguage?: string,
    targetLanguage?: string,
    generateThumbnails: boolean = true
  ): Promise<ProcessingResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);
      
      if (sourceLanguage) {
        formData.append('source_language', sourceLanguage);
      }
      
      if (targetLanguage) {
        formData.append('target_language', targetLanguage);
      }
      
      formData.append('generate_thumbnails', String(generateThumbnails));
      
      const response = await fetch(
        `${PPTX_PROCESSOR_URL}/v1/process`,
        {
          method: 'POST',
          headers: this.token ? {
            'Authorization': `Bearer ${this.token}`,
          } : {},
          body: formData,
        }
      );
      
      if (!response.ok) {
        // Handle specific error status codes
        if (response.status === 401) {
          throw new Error('Authentication failed: Invalid or expired token');
        } else if (response.status === 400) {
          const error = await response.json();
          throw new Error(`Invalid request: ${error.detail || 'Bad request'}`);
        } else if (response.status === 404) {
          throw new Error('PPTX processor service endpoint not found');
        } else if (response.status === 503) {
          throw new Error('PPTX processor service is currently unavailable');
        } else {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to process PPTX file');
        }
      }
      
      return response.json();
    } catch (error) {
      // Check for network-related errors (service unavailable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('PPTX processor service is unreachable');
        throw new Error('PPTX processor service is unreachable');
      }
      
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }
  
  /**
   * Get the status of a processing job
   */
  async getProcessingStatus(jobId: string): Promise<ProcessingResponse> {
    try {
      const response = await fetch(
        `${PPTX_PROCESSOR_URL}/v1/status/${jobId}`,
        {
          headers: this.token ? {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          } : {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        // Handle specific error status codes
        if (response.status === 401) {
          throw new Error('Authentication failed: Invalid or expired token');
        } else if (response.status === 404) {
          throw new Error('Job not found');
        } else if (response.status === 503) {
          throw new Error('PPTX processor service is currently unavailable');
        } else {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to get processing status');
        }
      }
      
      return response.json();
    } catch (error) {
      // Check for network-related errors (service unavailable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('PPTX processor service is unreachable');
        throw new Error('PPTX processor service is unreachable');
      }
      
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }
  
  /**
   * Get the results of a processing job
   */
  async getProcessingResults(sessionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${PPTX_PROCESSOR_URL}/v1/results/${sessionId}`,
        {
          headers: this.token ? {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          } : {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        // Handle specific error status codes
        if (response.status === 401) {
          throw new Error('Authentication failed: Invalid or expired token');
        } else if (response.status === 404) {
          throw new Error('Results not found');
        } else if (response.status === 503) {
          throw new Error('PPTX processor service is currently unavailable');
        } else {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to get processing results');
        }
      }
      
      return response.json();
    } catch (error) {
      // Check for network-related errors (service unavailable)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('PPTX processor service is unreachable');
        throw new Error('PPTX processor service is unreachable');
      }
      
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }

  /**
   * Check if the PPTX processor service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(
        `${PPTX_PROCESSOR_URL}/v1/health`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('PPTX processor health check failed:', error);
      return false;
    }
  }
} 