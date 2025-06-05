import { StateCreator } from 'zustand';
import { SubscriptionState } from '../types';

// Initial state for subscription management
const initialState: SubscriptionState = {
  activeSubscriptions: {},
  toggleSubscription: () => {},
  clearAllSubscriptions: () => {}
};

export const createSubscriptionSlice: StateCreator<
  SubscriptionState,
  [],
  [],
  SubscriptionState
> = (set) => ({
  ...initialState,

  /**
   * Toggle a subscription on or off
   * @param channel Channel name to toggle
   * @param active Whether to activate or deactivate the subscription
   */
  toggleSubscription: (channel: string, active: boolean) => {
    set(state => ({
      activeSubscriptions: {
        ...state.activeSubscriptions,
        [channel]: active
      }
    }));
  },

  /**
   * Clear all active subscriptions
   */
  clearAllSubscriptions: () => {
    set({
      activeSubscriptions: {}
    });
  }
}); 