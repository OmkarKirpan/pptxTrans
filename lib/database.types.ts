export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      translation_sessions: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
          status: string
          progress: number
          slide_count: number
          source_language: string | null
          target_language: string | null
          thumbnail_url: string | null
          original_file_path: string | null
          translated_file_path: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
          status?: string
          progress?: number
          slide_count?: number
          source_language?: string | null
          target_language?: string | null
          thumbnail_url?: string | null
          original_file_path?: string | null
          translated_file_path?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
          status?: string
          progress?: number
          slide_count?: number
          source_language?: string | null
          target_language?: string | null
          thumbnail_url?: string | null
          original_file_path?: string | null
          translated_file_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users" // Assuming 'users' table in 'auth' schema
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          id: string
          session_id: string
          slide_number: number
          svg_url: string | null
          original_width: number | null
          original_height: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          slide_number: number
          svg_url?: string | null
          original_width?: number | null
          original_height?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          slide_number?: number
          svg_url?: string | null
          original_width?: number | null
          original_height?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "translation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slide_shapes: {
        Row: {
          id: string
          slide_id: string
          shape_ppt_id: string | null
          type: string
          original_text: string | null
          translated_text: string | null
          x_coordinate: number
          y_coordinate: number
          width: number
          height: number
          coordinates_unit: string
          font_family: string | null
          font_size: number | null
          is_bold: boolean | null
          is_italic: boolean | null
          text_color: string | null
          text_align: string | null
          vertical_align: string | null
          background_color: string | null
          reading_order: number | null
          has_comments: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slide_id: string
          shape_ppt_id?: string | null
          type: string
          original_text?: string | null
          translated_text?: string | null
          x_coordinate: number
          y_coordinate: number
          width: number
          height: number
          coordinates_unit?: string
          font_family?: string | null
          font_size?: number | null
          is_bold?: boolean | null
          is_italic?: boolean | null
          text_color?: string | null
          text_align?: string | null
          vertical_align?: string | null
          background_color?: string | null
          reading_order?: number | null
          has_comments?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slide_id?: string
          shape_ppt_id?: string | null
          type?: string
          original_text?: string | null
          translated_text?: string | null
          x_coordinate?: number
          y_coordinate?: number
          width?: number
          height?: number
          coordinates_unit?: string
          font_family?: string | null
          font_size?: number | null
          is_bold?: boolean | null
          is_italic?: boolean | null
          text_color?: string | null
          text_align?: string | null
          vertical_align?: string | null
          background_color?: string | null
          reading_order?: number | null
          has_comments?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_shapes_slide_id_fkey"
            columns: ["slide_id"]
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_updated_at_column: {
        // Assuming this was the old name
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      update_updated_at_column_generic: {
        // The one we created
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    ? (Database["public"]["Tables"] & Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

// You might have other types or enums here if generated by Supabase CLI more comprehensively.
// For now, this covers the tables we've explicitly defined and used.
