import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

import type { AppStore } from './types'
import { createSessionSlice } from './slices/session-slice'
import { createSlidesSlice } from './slices/slides-slice'
import { createEditBuffersSlice } from './slices/edit-buffers-slice'
import { createCommentsSlice } from './slices/comments-slice'
import { createNotificationsSlice } from './slices/notifications-slice'
import { createMergeSlice } from './slices/merge-slice'
import { createShareSlice } from './slices/share-slice'

/**
 * Create the main application store by combining all slices
 * Wrapped with devtools middleware for better debugging
 * Added persist middleware for local storage persistence
 */
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
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
        
        // Share slice
        ...createShareSlice(...a),
      }),
      {
        name: 'pptx-translator-storage',
        partialize: (state) => ({
          // Only persist necessary parts of the state
          currentSession: state.currentSession,
          userRole: state.userRole,
          shareToken: state.shareToken,
          slides: state.slides,
          currentSlideId: state.currentSlideId,
          buffers: state.buffers,
          shares: state.shares,
          // Do not persist notifications and comments - these will be fetched from the server
        }),
        // Use localStorage for persistence (survives browser restarts)
        storage: typeof window !== 'undefined' ? {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => localStorage.removeItem(name),
        } : undefined,
      }
    ),
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
    syncStatus,
    reorderState,
    setSlides,
    setCurrentSlide,
    updateSlideShapes,
    updateShape,
    addSlide,
    removeSlide,
    reorderSlides,
    setSlidesLoading,
    setSlidesError,
    setSyncStatus,
    syncSlidesOrder,
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
    syncStatus,
    reorderState,
    setSlides,
    setCurrentSlide,
    updateSlideShapes,
    updateShape,
    addSlide,
    removeSlide,
    reorderSlides,
    setSlidesLoading,
    setSlidesError,
    setSyncStatus,
    syncSlidesOrder,
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

// Share slice hooks
export const useShare = () => {
  const {
    shares,
    isLoading,
    error,
    generateShareLink,
    listSessionShares,
    revokeShare,
    clearShares
  } = useAppStore((state) => ({
    shares: state.shares,
    isLoading: state.isLoading,
    error: state.error,
    generateShareLink: state.generateShareLink,
    listSessionShares: state.listSessionShares,
    revokeShare: state.revokeShare,
    clearShares: state.clearShares
  }));
  
  return {
    shares,
    isLoading,
    error,
    generateShareLink,
    listSessionShares,
    revokeShare,
    clearShares
  };
}

// Export a default
export default useAppStore 