import { StateCreator } from 'zustand';
import type { AppStore } from '../types';
import type { ShareRecord, SharePermissions } from '@/types';

export interface ShareState {
  shares: ShareRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  generateShareLink: (sessionId: string, permissions: SharePermissions, expiresAt?: Date) => Promise<string>;
  listSessionShares: (sessionId: string) => Promise<void>;
  revokeShare: (shareId: string) => Promise<void>;
  clearShares: () => void;
}

export const createShareSlice: StateCreator<
  AppStore,
  [],
  [],
  ShareState
> = (set, get) => ({
  shares: [],
  isLoading: false,
  error: null,
  
  generateShareLink: async (sessionId, permissions, expiresAt) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          permissions, 
          expiresAt: expiresAt?.toISOString() 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate share link');
      }
      
      const data = await response.json();
      
      // Refresh the list of shares after generating a new one
      get().listSessionShares(sessionId);
      
      return data.shareUrl;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  listSessionShares: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/share?sessionId=${sessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch shares');
      }
      
      const shares = await response.json();
      set({ shares });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  revokeShare: async (shareId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke share');
      }
      
      // Update the local state by removing the revoked share
      set((state) => ({
        shares: state.shares.filter((share) => share.id !== shareId)
      }));
      
      return;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  clearShares: () => set({ shares: [] }),
}); 