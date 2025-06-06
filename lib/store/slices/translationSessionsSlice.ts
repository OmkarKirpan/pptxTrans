import { StateCreator } from 'zustand';
import * as translationSessionApi from '@/lib/api/translationSessionApi';
import type {
  TranslationSession,
  CreateSessionPayload,
  UpdateSessionPayload,
  PaginatedSessions,
} from '@/types/api';

// Define the shape of the slice state
export interface TranslationSessionsSliceState {
  sessions: TranslationSession[];
  paginatedSessions: PaginatedSessions | null; // For holding paginated list responses
  currentSessionDetails: TranslationSession | null;
  isLoadingList: boolean;
  isLoadingDetails: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
}

// Define the actions available on the slice
export interface TranslationSessionsSliceActions {
  fetchSessions: (params?: { status?: string; sortBy?: string; page?: number; limit?: number }) => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<TranslationSession | null>;
  fetchSessionDetails: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, payload: UpdateSessionPayload) => Promise<TranslationSession | null>;
  deleteSession: (sessionId: string) => Promise<boolean>; // Returns true on success
  clearCurrentSessionDetails: () => void;
  clearError: () => void;
  // New actions for status transitions
  markSessionInProgress: (sessionId: string) => Promise<TranslationSession | null>;
  markSessionCompleted: (sessionId: string) => Promise<TranslationSession | null>;
}

// Combine state and actions into a single type for the slice
export type TranslationSessionsSlice = TranslationSessionsSliceState & TranslationSessionsSliceActions;

// Initial state for the slice
const initialState: TranslationSessionsSliceState = {
  sessions: [], // Kept for potential non-paginated direct use, or could be removed if always using paginatedSessions.items
  paginatedSessions: null,
  currentSessionDetails: null,
  isLoadingList: false,
  isLoadingDetails: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
};

// Create the slice using StateCreator
export const createTranslationSessionsSlice: StateCreator<
  TranslationSessionsSlice,
  [], // No middleware with specific types like persist here, add if needed
  [],
  TranslationSessionsSlice
> = (set, get) => ({
  ...initialState,

  fetchSessions: async (params) => {
    set({ isLoadingList: true, error: null });
    try {
      const responseData = await translationSessionApi.listSessions(params);
      if (Array.isArray(responseData)) {
        // It's TranslationSession[] from a non-paginated endpoint or fallback
        set({
          sessions: responseData,
          // Construct a PaginatedSessions object for consistency in the store if some parts expect it.
          // If all UI consuming lists can handle raw `sessions` array and `paginatedSessions` being null, 
          // then paginatedSessions could be set to null here.
          paginatedSessions: {
            items: responseData,
            total: responseData.length,
            page: params?.page || 1,
            limit: params?.limit || responseData.length, 
            totalPages: Math.ceil(responseData.length / (params?.limit || responseData.length)) || 1,
          },
          isLoadingList: false
        });
      } else {
        // It's PaginatedSessions
        set({
          sessions: responseData.items, // Ensure sessions array is also updated from paginated items
          paginatedSessions: responseData,
          isLoadingList: false
        });
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch sessions', 
        isLoadingList: false, 
        sessions: [], // Reset on error
        paginatedSessions: null // Reset on error
      });
    }
  },

  createSession: async (payload) => {
    set({ isCreating: true, error: null });
    try {
      const newSession = await translationSessionApi.createSession(payload);
      // Optimistically add or refetch list
      // For simplicity, we can refetch the list or let UI trigger refetch
      // Or, if response is full session object, add to list:
      // set((state) => ({ sessions: [newSession, ...state.sessions] }));
      set({ isCreating: false });
      // Consider fetching all sessions again to reflect the new one in any view
      // await get().fetchSessions(); // Or handle this at UI level post-creation
      return newSession;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create session', isCreating: false });
      return null;
    }
  },

  fetchSessionDetails: async (sessionId) => {
    set({ isLoadingDetails: true, error: null, currentSessionDetails: null });
    try {
      const session = await translationSessionApi.getSessionById(sessionId);
      set({ currentSessionDetails: session, isLoadingDetails: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch session details', isLoadingDetails: false });
    }
  },

  updateSession: async (sessionId, payload) => {
    set({ isUpdating: true, error: null });
    try {
      const updatedSession = await translationSessionApi.updateSession(sessionId, payload);
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? updatedSession : s)),
        paginatedSessions: state.paginatedSessions ? {
            ...state.paginatedSessions,
            items: state.paginatedSessions.items.map((s) => (s.id === sessionId ? updatedSession : s)),
        } : null,
        currentSessionDetails: state.currentSessionDetails?.id === sessionId ? updatedSession : state.currentSessionDetails,
        isUpdating: false,
      }));
      return updatedSession;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update session', isUpdating: false });
      return null;
    }
  },

  deleteSession: async (sessionId) => {
    set({ isDeleting: true, error: null });
    try {
      await translationSessionApi.deleteSession(sessionId);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        paginatedSessions: state.paginatedSessions ? {
            ...state.paginatedSessions,
            items: state.paginatedSessions.items.filter((s) => s.id !== sessionId),
            // Note: `total` in paginatedSessions might become stale here without a refetch or server-side adjustment
        } : null,
        currentSessionDetails: state.currentSessionDetails?.id === sessionId ? null : state.currentSessionDetails,
        isDeleting: false,
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete session', isDeleting: false });
      return false;
    }
  },
  
  clearCurrentSessionDetails: () => {
    set({ currentSessionDetails: null });
  },

  clearError: () => {
    set({ error: null });
  },

  // Implementation of new status transition actions
  markSessionInProgress: async (sessionId) => {
    // Optimistically update status in UI, or wait for API response
    // For simplicity, we rely on updateSession to handle state updates
    const updatedSession = await get().updateSession(sessionId, { status: 'in_progress' });
    return updatedSession;
  },

  markSessionCompleted: async (sessionId) => {
    const updatedSession = await get().updateSession(sessionId, { status: 'completed' });
    return updatedSession;
  },
}); 