// These types should mirror the structures defined in the TranslationSessionService's model.ts
// and the Supabase table schema for translation_sessions.

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
  // Include other fields from TranslationSession that are updatable, for example:
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
  totalPages: number; // This was in the controller, useful for frontend
}

// You might also want to include other API-related types here as your app grows. 