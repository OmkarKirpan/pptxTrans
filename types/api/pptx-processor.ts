import { ProcessingStatus } from '@/types/pptx-processor';

export interface ExportResponse {
  job_id: string;
  session_id: string;
  status: ProcessingStatus;
  created_at?: string;
  message?: string;
}

export interface DownloadUrlResponse {
  download_url: string;
  expires_at: string;
} 