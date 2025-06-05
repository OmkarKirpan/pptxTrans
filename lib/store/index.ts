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
import { createTranslationSessionsSlice, type TranslationSessionsSlice } from './slices/translationSessionsSlice'

// The AppStore type from ./types already includes all slices including the new share slice.
// No need for ExtendedAppStore if AppStore is comprehensive.
// type ExtendedAppStore = AppStore & TranslationSessionsSlice; // Review if TranslationSessionsSlice is already in AppStore

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
        
        // Translation Sessions slice (NEW)
        ...createTranslationSessionsSlice(...a),
      }),
      {
        name: 'pptx-translator-storage',
        partialize: (state) => ({
          // Session slice parts
          userRole: state.userRole,
          shareToken: state.shareToken,
          // Slides slice parts
          slides: state.slides,
          currentSlideId: state.currentSlideId,
          // Edit buffers slice parts
          buffers: state.buffers,
          // Share slice parts (Update this part)
          sessionShares: state.sessionShares, // Persist sessionShares from the new ShareSliceState
          // Translation sessions parts
          sessions: state.sessions,
          paginatedSessions: state.paginatedSessions,
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
    // currentSession, // Removed
    userRole, 
    shareToken, 
    // isLoading, // Removed
    // error, // Removed
    // setSession, // Removed
    setUserRole, // Added
    setShareToken,
    // setLoading, // Removed
    // setError, // Removed
    clearSession 
  } = useAppStore()
  
  return {
    // currentSession, // Removed
    userRole,
    shareToken,
    // isLoading, // Removed
    // error, // Removed
    // setSession, // Removed
    setUserRole, // Added
    setShareToken,
    // setLoading, // Removed
    // setError, // Removed
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
    cancelReorder,
    fetchSlidesForSession
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
    fetchSlidesForSession,
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

// Share slice hooks (REPLACE existing useShare hook)
export const useShare = () => {
  const {
    sessionShares,
    isLoadingCreate,
    isLoadingSessionShares,
    isLoadingRevoke,
    errorCreate,
    errorSessionShares,
    errorRevoke,
    createShare,
    fetchShares,
    revokeShare,
    clearSharesForSession,
    clearAllShares,
  } = useAppStore();

  return {
    sessionShares,
    isLoadingCreate,
    isLoadingSessionShares,
    isLoadingRevoke,
    errorCreate,
    errorSessionShares,
    errorRevoke,
    createShare,
    fetchShares,
    revokeShare,
    clearSharesForSession,
    clearAllShares,
  };
}

// Translation Sessions slice hooks (NEW)
export const useTranslationSessions = () => {
  const {
    sessions,
    paginatedSessions,
    currentSessionDetails,
    isLoadingList,
    isLoadingDetails,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchSessions,
    createSession,
    fetchSessionDetails,
    updateSession,
    deleteSession,
    clearCurrentSessionDetails,
    clearError,
    markSessionInProgress,
    markSessionCompleted
  } = useAppStore()
  
  return {
    sessions,
    paginatedSessions,
    currentSessionDetails,
    isLoadingList,
    isLoadingDetails,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchSessions,
    createSession,
    fetchSessionDetails,
    updateSession,
    deleteSession,
    clearCurrentSessionDetails,
    clearError,
    markSessionInProgress,
    markSessionCompleted
  }
}

// Export a default
export default useAppStore 