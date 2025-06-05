import { StateCreator } from 'zustand';
import { produce } from 'immer';
import {
  ShareRecord,
  SharePermission,
  CreatedShareInfo,
} from '@/types/share';
import {
  createShare,
  getMyShares,
  deleteShare,
} from '@/lib/api/shareApi';

// Define the state structure for shares
export interface ShareSliceState {
  sessionShares: Record<string, ShareRecord[]>; // sessionId -> shares array
  isLoadingCreate: boolean;
  isLoadingSessionShares: Record<string, boolean>; // sessionId -> boolean, renamed from isLoadingList
  isLoadingRevoke: Record<string, boolean>; // shareTokenJti -> boolean
  errorCreate: string | null;
  errorList: Record<string, string | null>; // sessionId -> error message
  errorRevoke: Record<string, string | null>; // shareTokenJti -> error message
}

// Define the actions available on the share slice
export interface ShareSliceActions {
  createShare: (
    sessionId: string,
    permissions: SharePermission[],
    expiresIn?: string,
    name?: string
  ) => Promise<CreatedShareInfo | null>;
  fetchShares: (sessionId: string) => Promise<void>;
  revokeShare: (
    shareTokenJti: string,
    sessionId: string // Needed to update the correct session's list
  ) => Promise<void>;
  clearSharesForSession: (sessionId: string) => void;
  clearAllShares: () => void;
}

const initialState: ShareSliceState = {
  sessionShares: {},
  isLoadingCreate: false,
  isLoadingSessionShares: {}, // renamed from isLoadingList
  isLoadingRevoke: {},
  errorCreate: null,
  errorList: {},
  errorRevoke: {},
};

export const createShareSlice: StateCreator<
  ShareSliceState & ShareSliceActions,
  [],
  [],
  ShareSliceState & ShareSliceActions
> = (set, get) => ({
  ...initialState,

  createShare: async (sessionId, permissions, expiresIn, name) => {
    set(produce((state: ShareSliceState) => {
      state.isLoadingCreate = true;
      state.errorCreate = null;
    }));
    try {
      // Use the first permission in the array for now
      // This could be enhanced to create multiple shares with different permissions
      const permission = permissions.length > 0 ? permissions[0] : SharePermission.VIEW;
      const newShareInfo = await createShare(sessionId, expiresIn, permission);
      set(produce((state: ShareSliceState) => {
        state.isLoadingCreate = false;
      }));
      // After creating, refresh the list for that session to get the full new record
      await get().fetchShares(sessionId);
      return newShareInfo;
    } catch (error: any) {
      set(produce((state: ShareSliceState) => {
        state.isLoadingCreate = false;
        state.errorCreate = error.message || 'Failed to create share link.';
      }));
      return null;
    }
  },

  fetchShares: async (sessionId) => {
    set(produce((state: ShareSliceState) => {
      state.isLoadingSessionShares[sessionId] = true;
      state.errorList[sessionId] = null;
    }));
    try {
      // For now, we'll use getMyShares and filter for the session
      // Ideally, the API would have a getSharesForSession endpoint
      const allShares = await getMyShares();
      const sessionShares = allShares.filter(share => share.session_id === sessionId);
      
      set(produce((state: ShareSliceState) => {
        state.isLoadingSessionShares[sessionId] = false;
        state.sessionShares[sessionId] = sessionShares;
      }));
    } catch (error: any) {
      set(produce((state: ShareSliceState) => {
        state.isLoadingSessionShares[sessionId] = false;
        state.errorList[sessionId] = error.message || 'Failed to fetch shares.';
      }));
    }
  },

  revokeShare: async (shareTokenJti, sessionId) => {
    set(produce((state: ShareSliceState) => {
      state.isLoadingRevoke[shareTokenJti] = true;
      state.errorRevoke[shareTokenJti] = null;
    }));
    try {
      await deleteShare(shareTokenJti);
      set(produce((state: ShareSliceState) => {
        state.isLoadingRevoke[shareTokenJti] = false;
        if (state.sessionShares[sessionId]) {
          state.sessionShares[sessionId] = state.sessionShares[sessionId].filter(
            (share) => share.share_token_jti !== shareTokenJti
          );
        }
      }));
    } catch (error: any) {
      set(produce((state: ShareSliceState) => {
        state.isLoadingRevoke[shareTokenJti] = false;
        state.errorRevoke[shareTokenJti] = error.message || 'Failed to revoke share link.';
      }));
    }
  },

  clearSharesForSession: (sessionId) => {
    set(produce((state: ShareSliceState) => {
      delete state.sessionShares[sessionId];
      delete state.isLoadingSessionShares[sessionId];
      delete state.errorList[sessionId];
    }));
  },

  clearAllShares: () => {
    set(initialState);
  },
}); 