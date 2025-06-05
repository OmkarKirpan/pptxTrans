export interface TranslationSession {
  id: string; // uuid
  user_id: string; // uuid
  session_name: string;
  original_file_name?: string;
  source_language_code: string;
  target_language_codes: string[];
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  slide_count?: number;
  created_at: string; // ISO 8601 date-time
  updated_at: string; // ISO 8601 date-time
  last_opened_at?: string; // ISO 8601 date-time
}

export interface CreateSessionPayload {
  session_name: string;
  original_file_name?: string;
  source_language_code: string;
  target_language_codes: string[];
  slide_count?: number;
}

export interface UpdateSessionPayload {
  session_name?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
  last_opened_at?: string; // ISO 8601
  // Add other updatable fields from TranslationSession as needed, e.g.:
  // original_file_name?: string;
  // source_language_code?: string;
  // target_language_codes?: string[];
  // slide_count?: number;
}

export interface PaginatedSessions {
  items: TranslationSession[];
  total: number;
  page: number;
  limit: number;
} 