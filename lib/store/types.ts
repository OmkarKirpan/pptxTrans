import type { ProcessedSlide, SlideShape, TranslationSession } from '@/types'

// User role in a session
export type UserRole = 'owner' | 'reviewer' | 'viewer'

// Edit buffer for tracking text changes
export interface EditBuffer {
  shapeId: string
  slideId: string
  originalText: string
  translatedText: string
  isDirty: boolean
  lastModified: Date
}

// Comment structure
export interface Comment {
  id: string
  shapeId: string
  slideId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: Date
  updatedAt: Date
  isResolved: boolean
  parentId?: string // For replies
}

// Notification for new comments
export interface CommentNotification {
  commentId: string
  shapeId: string
  slideId: string
  isRead: boolean
  createdAt: Date
}

// Slide reorder state
export interface SlideReorderState {
  isReordering: boolean
  draggedSlideId: string | null
  targetPosition: number | null
}

// Shape selection for merge operations
export interface MergeSelection {
  slideId: string
  selectedShapeIds: string[]
}

// Session state slice
export interface SessionState {
  currentSession: TranslationSession | null
  userRole: UserRole
  shareToken: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setSession: (session: TranslationSession, role: UserRole) => void
  setShareToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearSession: () => void
}

// Slides state slice
export interface SlidesState {
  slides: ProcessedSlide[]
  currentSlideId: string | null
  slidesLoading: boolean
  slidesError: string | null
  
  // Reorder state
  reorderState: SlideReorderState
  
  // Actions
  setSlides: (slides: ProcessedSlide[]) => void
  setCurrentSlide: (slideId: string) => void
  updateSlideShapes: (slideId: string, shapes: SlideShape[]) => void
  addSlide: (slide: ProcessedSlide) => void
  removeSlide: (slideId: string) => void
  reorderSlides: (fromIndex: number, toIndex: number) => void
  setSlidesLoading: (loading: boolean) => void
  setSlidesError: (error: string | null) => void
  
  // Reorder actions
  startReorder: (slideId: string) => void
  updateReorderTarget: (position: number) => void
  completeReorder: () => void
  cancelReorder: () => void
}

// Edit buffers state slice
export interface EditBuffersState {
  buffers: Record<string, EditBuffer> // Keyed by shapeId
  activeBufferId: string | null
  
  // Actions
  createBuffer: (shapeId: string, slideId: string, originalText: string, translatedText?: string) => void
  updateBuffer: (shapeId: string, translatedText: string) => void
  saveBuffer: (shapeId: string) => void
  discardBuffer: (shapeId: string) => void
  setActiveBuffer: (shapeId: string | null) => void
  clearBuffers: () => void
}

// Comments state slice
export interface CommentsState {
  comments: Record<string, Comment[]> // Keyed by shapeId
  loadingComments: Record<string, boolean> // Loading state per shape
  
  // Actions
  setComments: (shapeId: string, comments: Comment[]) => void
  addComment: (comment: Comment) => void
  updateComment: (commentId: string, updates: Partial<Comment>) => void
  deleteComment: (commentId: string, shapeId: string) => void
  setCommentsLoading: (shapeId: string, loading: boolean) => void
  clearComments: () => void
}

// Notifications state slice
export interface NotificationsState {
  notifications: CommentNotification[]
  unreadCount: number
  
  // Actions
  addNotification: (notification: CommentNotification) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
}

// Merge selection state slice
export interface MergeState {
  selections: Record<string, MergeSelection> // Keyed by slideId
  isMergeMode: boolean
  
  // Actions
  enterMergeMode: () => void
  exitMergeMode: () => void
  toggleShapeSelection: (slideId: string, shapeId: string) => void
  clearSelection: (slideId: string) => void
  clearAllSelections: () => void
}

// Combined store type
export interface AppStore extends 
  SessionState,
  SlidesState,
  EditBuffersState,
  CommentsState,
  NotificationsState,
  MergeState {} 