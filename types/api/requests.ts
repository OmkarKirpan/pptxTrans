// API request types

export interface UploadPresentationRequest {
  file: File
  title: string
  metadata?: Record<string, any>
}

export interface UpdatePresentationRequest {
  id: string
  title?: string
  metadata?: Record<string, any>
}

export interface ProcessSlideRequest {
  presentationId: string
  slideNumber: number
  content: any
}

export interface TranslationRequest {
  text: string
  sourceLanguage: string
  targetLanguage: string
} 