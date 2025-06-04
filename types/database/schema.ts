// Database schema types
// Moved from lib/database.types.ts

export interface Database {
  public: {
    Tables: {
      presentations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          user_id: string
          status: 'processing' | 'ready' | 'error'
          file_path: string
          metadata: any
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          user_id: string
          status?: 'processing' | 'ready' | 'error'
          file_path: string
          metadata?: any
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          user_id?: string
          status?: 'processing' | 'ready' | 'error'
          file_path?: string
          metadata?: any
        }
      }
      slides: {
        Row: {
          id: string
          presentation_id: string
          slide_number: number
          content: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          presentation_id: string
          slide_number: number
          content: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          presentation_id?: string
          slide_number?: number
          content?: any
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 