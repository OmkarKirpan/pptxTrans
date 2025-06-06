// Types index file
// Export all types from their respective modules

export * from './database/schema'
export * from './api/requests'
export * from './store/session'

// Re-export commonly used types
export type { Database } from './database/schema'
export type { UploadPresentationRequest, UpdatePresentationRequest } from './api/requests'
export type { User, SessionState, SessionActions } from './store/session'

export type SessionStatus = "draft" | "in-progress" | "ready"

export interface SlideShape {
  id: string
  slide_id: string
  shape_ppt_id?: string | null
  type: string
  original_text?: string | null
  translated_text?: string | null
  x_coordinate: number // Percentage or pixels
  y_coordinate: number // Percentage or pixels
  width: number // Percentage or pixels
  height: number // Percentage or pixels
  coordinates_unit: "percentage" | "px"
  font_family?: string | null
  font_size?: number | null // Points, needs conversion for display
  is_bold?: boolean | null
  is_italic?: boolean | null
  text_color?: string | null
  text_align?: "left" | "center" | "right" | "justify" | null
  vertical_align?: "top" | "middle" | "bottom" | null
  background_color?: string | null
  reading_order?: number | null
  has_comments: boolean
  created_at: string
  updated_at: string
  // Auto-translation properties
  is_auto_translated?: boolean // Flag indicating if the text was automatically translated
  translated_metadata?: {
    is_auto_translated?: boolean,
    translation_source?: string,
    confidence_score?: number,
    translation_date?: string
  } // Additional metadata about the translation
  // UI state flags - not persisted to database
  _pendingUpdate?: boolean // Flag for optimistic updates
  _localChanges?: boolean // Flag for changes made locally but not yet synchronized
}

export interface ProcessedSlide {
  id: string
  session_id: string
  slide_number: number
  svg_url: string | null // URL to the SVG image of the slide
  original_width?: number | null // Original width of the slide (e.g., in pixels or points)
  original_height?: number | null // Original height of the slide
  created_at: string
  updated_at: string
  shapes: SlideShape[]
  // UI state flags - not persisted to database
  _pendingSync?: boolean // Flag indicating slide is being synced
}

export interface UploadedFile {
  file: File
  previewUrl?: string
  progress: number
  error?: string
  storagePath?: string // Path in Supabase storage
  publicUrl?: string // Public URL for the file
}

// Export share types
export interface ShareRecord {
  id: string;
  session_id: string;
  share_token: string;
  role: 'viewer' | 'commenter' | 'reviewer';
  permissions: SharePermissions;
  email?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SharePermissions {
  read: boolean;
  comment: boolean;
  edit: boolean;
}
