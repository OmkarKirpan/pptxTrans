import { StateCreator } from 'zustand';
import { produce } from 'immer';
import {
  ShareRecord,
  SharePermission,
  CreatedShareInfo,
} from '@/types/share';
import {
  createShareToken as apiCreateShareToken,
  listShareTokens as apiListShareTokens,
  revokeShareToken as apiRevokeShareToken,
} from '@/lib/api/shareApi';

// Define the state structure for shares
export interface ShareSliceState {
  sessionShares: Record<string, ShareRecord[]>; // sessionId -> shares array
  isLoadingCreate: boolean;
  isLoadingList: Record<string, boolean>; // sessionId -> boolean
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
  isLoadingList: {},
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
      const newShareInfo = await apiCreateShareToken(sessionId, permissions, expiresIn, name);
      set(produce((state: ShareSliceState) => {
        state.isLoadingCreate = false;
        // We don't add to sessionShares here directly because the full ShareRecord isn't returned by create,
        // only CreatedShareInfo. We should refetch or the share list should update via real-time if implemented.
        // For now, we rely on a subsequent fetchShares or a UI refresh.
        // Alternatively, construct a partial ShareRecord if absolutely necessary for optimistic updates.
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
      state.isLoadingList[sessionId] = true;
      state.errorList[sessionId] = null;
    }));
    try {
      const shares = await apiListShareTokens(sessionId);
      set(produce((state: ShareSliceState) => {
        state.isLoadingList[sessionId] = false;
        state.sessionShares[sessionId] = shares;
      }));
    } catch (error: any) {
      set(produce((state: ShareSliceState) => {
        state.isLoadingList[sessionId] = false;
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
      await apiRevokeShareToken(shareTokenJti);
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
      delete state.isLoadingList[sessionId];
      delete state.errorList[sessionId];
    }));
  },

  clearAllShares: () => {
    set(initialState);
  },
}); 