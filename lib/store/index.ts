import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import type { AppStore } from './types'
import { createSessionSlice } from './slices/session-slice'
import { createSlidesSlice } from './slices/slides-slice'
import { createEditBuffersSlice } from './slices/edit-buffers-slice'
import { createCommentsSlice } from './slices/comments-slice'
import { createNotificationsSlice } from './slices/notifications-slice'
import { createMergeSlice } from './slices/merge-slice'

/**
 * Create the main application store by combining all slices
 * Wrapped with devtools middleware for better debugging
 */
export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      // Session slice
      ...createSessionSlice(...a),
      
      // Slides slice
      ...createSlidesSlice(...a),
      
      // Edit buffers slice
      ...createEditBuffersSlice(...a),
      
      // Comments slice
      ...createCommentsSlice(...a),
      
      // Notifications slice
      ...createNotificationsSlice(...a),
      
      // Merge slice
      ...createMergeSlice(...a),
    }),
    {
      name: 'PowerPoint-Translator-Store',
      enabled: process.env.NODE_ENV !== 'production'
    }
  )
)

/**
 * Custom hooks for accessing specific parts of the store
 */

// Session slice hooks
export const useSession = () => {
  const { 
    currentSession, 
    userRole, 
    shareToken, 
    isLoading, 
    error,
    setSession,
    setShareToken,
    setLoading,
    setError,
    clearSession 
  } = useAppStore()
  
  return {
    currentSession,
    userRole,
    shareToken,
    isLoading,
    error,
    setSession,
    setShareToken,
    setLoading,
    setError,
    clearSession
  }
}

// Slides slice hooks
export const useSlides = () => {
  const { 
    slides, 
    currentSlideId,
    slidesLoading,
    slidesError,
    reorderState,
    setSlides,
    setCurrentSlide,
    updateSlideShapes,
    addSlide,
    removeSlide,
    reorderSlides,
    setSlidesLoading,
    setSlidesError,
    startReorder,
    updateReorderTarget,
    completeReorder,
    cancelReorder
  } = useAppStore()
  
  return {
    slides,
    currentSlideId,
    slidesLoading,
    slidesError,
    reorderState,
    setSlides,
    setCurrentSlide,
    updateSlideShapes,
    addSlide,
    removeSlide,
    reorderSlides,
    setSlidesLoading,
    setSlidesError,
    startReorder,
    updateReorderTarget,
    completeReorder,
    cancelReorder,
    // Computed values
    currentSlide: slides.find(slide => slide.id === currentSlideId) || null
  }
}

// Edit buffers slice hooks
export const useEditBuffers = () => {
  const {
    buffers,
    activeBufferId,
    createBuffer,
    updateBuffer,
    saveBuffer,
    discardBuffer,
    setActiveBuffer,
    clearBuffers
  } = useAppStore()
  
  return {
    buffers,
    activeBufferId,
    createBuffer,
    updateBuffer,
    saveBuffer,
    discardBuffer,
    setActiveBuffer,
    clearBuffers,
    // Computed values
    activeBuffer: activeBufferId ? buffers[activeBufferId] || null : null
  }
}

// Comments slice hooks
export const useComments = (shapeId?: string) => {
  const {
    comments,
    loadingComments,
    setComments,
    addComment,
    updateComment,
    deleteComment,
    setCommentsLoading,
    clearComments
  } = useAppStore()
  
  return {
    // If shapeId is provided, return comments for that shape only
    comments: shapeId ? comments[shapeId] || [] : comments,
    loadingComments,
    isLoading: shapeId ? loadingComments[shapeId] || false : false,
    setComments,
    addComment,
    updateComment,
    deleteComment,
    setCommentsLoading,
    clearComments
  }
}

// Notifications slice hooks
export const useNotifications = () => {
  const {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications
  } = useAppStore()
  
  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications
  }
}

// Merge slice hooks
export const useMergeSelection = (slideId?: string) => {
  const {
    selections,
    isMergeMode,
    enterMergeMode,
    exitMergeMode,
    toggleShapeSelection,
    clearSelection,
    clearAllSelections
  } = useAppStore()
  
  return {
    // If slideId is provided, return selection for that slide only
    selections: slideId ? selections[slideId] || null : selections,
    isMergeMode,
    enterMergeMode,
    exitMergeMode,
    toggleShapeSelection,
    clearSelection,
    clearAllSelections
  }
}

// Export a default
export default useAppStore 