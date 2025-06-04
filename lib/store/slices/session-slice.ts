import { StateCreator } from 'zustand'
import type { SessionState } from '../types'
import type { TranslationSession } from '@/types'
import type { UserRole } from '../types'

export const createSessionSlice: StateCreator<SessionState> = (set) => ({
  currentSession: null,
  userRole: 'viewer',
  shareToken: null,
  isLoading: false,
  error: null,

  setSession: (session: TranslationSession, role: UserRole) => 
    set({ currentSession: session, userRole: role, error: null }),
  
  setShareToken: (token: string | null) => 
    set({ shareToken: token }),
  
  setLoading: (loading: boolean) => 
    set({ isLoading: loading }),
  
  setError: (error: string | null) => 
    set({ error }),
  
  clearSession: () => 
    set({ 
      currentSession: null, 
      userRole: 'viewer', 
      shareToken: null, 
      error: null 
    }),
}) 