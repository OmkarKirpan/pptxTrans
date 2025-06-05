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
import { createMigrationSlice } from './slices/migration-slice'
import { createNetworkSlice } from './slices/network-slice'
import { createOfflineQueueSlice } from './slices/offline-queue-slice'
import { createSubscriptionSlice } from './slices/subscription-slice'

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
      (...a) => {
        // Create slices
        const migrationSlice = createMigrationSlice(...a);
        const sessionSlice = createSessionSlice(...a);
        const slidesSlice = createSlidesSlice(...a);
        const editBuffersSlice = createEditBuffersSlice(...a);
        const commentsSlice = createCommentsSlice(...a);
        const notificationsSlice = createNotificationsSlice(...a);
        const mergeSlice = createMergeSlice(...a);
        const shareSlice = createShareSlice(...a);
        const translationSessionsSlice = createTranslationSessionsSlice(...a);
        const networkSlice = createNetworkSlice(...a);
        const offlineQueueSlice = createOfflineQueueSlice(...a);
        const subscriptionSlice = createSubscriptionSlice(...a);
        
        // Combine all slices
        return {
          // Migration slice (must be first to ensure migrations are available)
          ...migrationSlice,
          
          // Session slice
          ...sessionSlice,
          
          // Slides slice
          ...slidesSlice,
          
          // Edit buffers slice
          ...editBuffersSlice,
          
          // Comments slice
          ...commentsSlice,
          
          // Notifications slice
          ...notificationsSlice,
          
          // Merge slice
          ...mergeSlice,
          
          // Share slice
          ...shareSlice,
          
          // Translation Sessions slice
          ...translationSessionsSlice,
          
          // Network slice
          ...networkSlice,
          
          // Offline queue slice
          ...offlineQueueSlice,
          
          // Subscription slice
          ...subscriptionSlice,
        };
      },
      {
        name: 'pptx-translator-storage',
        version: 1, // Add version for migration tracking
        partialize: (state) => ({
          // Store version for migrations
          version: state.currentVersion,
          
          // Session slice parts
          userRole: state.userRole,
          shareToken: state.shareToken,
          
          // Slides slice parts
          slides: state.slides,
          currentSlideId: state.currentSlideId,
          
          // Edit buffers slice parts
          buffers: state.buffers,
          
          // Share slice parts
          sessionShares: state.sessionShares,
          
          // Translation sessions parts
          sessions: state.sessions,
          paginatedSessions: state.paginatedSessions,
          
          // Offline queue
          operations: state.operations,
          
          // Subscriptions
          activeSubscriptions: state.activeSubscriptions,
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
        // Add onRehydrateStorage for migration handling
        onRehydrateStorage: () => (state) => {
          if (state) {
            console.log('Store rehydrated');
            
            // Restore online listeners
            if (typeof window !== 'undefined') {
              window.addEventListener('online', () => state.setOnline(true));
              window.addEventListener('offline', () => state.setOnline(false));
              
              // Process any pending operations if we're online
              if (navigator.onLine && state.operations?.length > 0) {
                state.processQueue();
              }
            }
          }
        },
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
    userRole, 
    shareToken,
    setUserRole,
    setShareToken,
    clearSession 
  } = useAppStore()
  
  return {
    userRole,
    shareToken,
    setUserRole,
    setShareToken,
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

// Share slice hooks
export const useShare = () => {
  const {
    sessionShares,
    isLoadingCreate,
    isLoadingSessionShares,
    isLoadingRevoke,
    errorCreate,
    errorList: errorSessionShares,
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

// Translation Sessions slice hooks
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

// New hooks for accessing the new slices

// Migration slice hooks
export const useMigration = () => {
  const {
    currentVersion,
    migrations,
    registerMigration,
    migrateToLatest
  } = useAppStore()
  
  return {
    currentVersion,
    migrations,
    registerMigration,
    migrateToLatest
  }
}

// Network state hooks
export const useNetwork = () => {
  const {
    isOnline,
    setOnline
  } = useAppStore()
  
  return {
    isOnline,
    setOnline
  }
}

// Offline queue hooks
export const useOfflineQueue = () => {
  const {
    operations,
    addOperation,
    removeOperation,
    processQueue,
    clearQueue
  } = useAppStore()
  
  return {
    operations,
    addOperation,
    removeOperation,
    processQueue,
    clearQueue
  }
}

// Subscription hooks
export const useSubscription = () => {
  const {
    activeSubscriptions,
    toggleSubscription,
    clearAllSubscriptions
  } = useAppStore()
  
  return {
    activeSubscriptions,
    toggleSubscription,
    clearAllSubscriptions
  }
}

// Export a default
export default useAppStore 