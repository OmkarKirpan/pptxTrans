import { StateCreator } from 'zustand';
import { NetworkState } from '../types';

// Initial state for network detection
const initialState: NetworkState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: () => {}
};

export const createNetworkSlice: StateCreator<
  NetworkState,
  [],
  [],
  NetworkState
> = (set) => ({
  ...initialState,

  /**
   * Set the online status
   * @param isOnline Whether the client is online
   */
  setOnline: (isOnline: boolean) => {
    set({ isOnline });
  }
}); 