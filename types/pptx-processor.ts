export type ProcessingStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'failed';

export interface ProcessingResponse {
  job_id: string;
  session_id: string;
  status: ProcessingStatus;
  progress: number;
  current_stage?: string;
  error?: string;
  message?: string;
  estimated_completion_time?: string;
  completed_at?: string;
}

export interface ProcessedPresentation {
  session_id: string;
  slide_count: number;
  slides: ProcessedSlide[];
  metadata: {
    original_filename: string;
    source_language?: string;
    target_language?: string;
    processing_time?: number;
  };
}

export interface ProcessedSlide {
  slide_id: string;
  slide_number: number;
  svg_url: string;
  original_width: number;
  original_height: number;
  thumbnail_url?: string;
  shapes: SlideShape[];
}

export interface SlideShape {
  shape_id: string;
  shape_type: string;
  original_text?: string;
  x_coordinate: number;
  y_coordinate: number;
  width: number;
  height: number;
  coordinates_unit: 'percentage' | 'px' | 'emu';
  font_size?: number;
  font_family?: string;
  font_weight?: string;
  font_style?: string;
  color?: string;
  reading_order?: number;
} 