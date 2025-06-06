import { StateCreator } from 'zustand'
import type { SessionState, UserRole } from '../types'
// import type { TranslationSession } from '@/types' // Removed, no longer used here

export const createSessionSlice: StateCreator<SessionState> = (set) => ({
  // currentSession: null, // Removed
  userRole: 'viewer', // Default value
  shareToken: null,
  // isLoading: false, // Removed
  // error: null, // Removed

  // setSession: (session: TranslationSession, role: UserRole) =>  // Removed
  //   set({ currentSession: session, userRole: role, error: null }),
  setUserRole: (role: UserRole) => 
    set({ userRole: role }),
  
  setShareToken: (token: string | null) => 
    set({ shareToken: token }),
  
  // setLoading: (loading: boolean) => // Removed
  //   set({ isLoading: loading }),
  
  // setError: (error: string | null) => // Removed
  //   set({ error }),
  
  clearSession: () => 
    set({ 
      // currentSession: null, // Removed
      userRole: 'viewer', // Reset to default
      shareToken: null, 
      // error: null // Removed
    }),
}) 