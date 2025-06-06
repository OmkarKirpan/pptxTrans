import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '../index';

const supabase = createClient();

// Store active subscription references
const activeChannels = new Map<string, any>();

/**
 * Subscribe to a specific channel if not already subscribed
 * @param channelName Name of the channel to subscribe to
 * @param callback Callback function for subscription events
 */
export function subscribeToChannel(channelName: string, callback: (payload: any) => void) {
  const { activeSubscriptions, toggleSubscription } = useSubscription();

  // Check if already subscribed
  if (activeSubscriptions[channelName]) {
    console.log(`Already subscribed to channel: ${channelName}`);
    return;
  }

  console.log(`Subscribing to channel: ${channelName}`);

  // Create the subscription
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public' }, callback)
    .subscribe();

  // Store the channel reference
  activeChannels.set(channelName, channel);

  // Update subscription state
  toggleSubscription(channelName, true);

  return channel;
}

/**
 * Unsubscribe from a specific channel
 * @param channelName Name of the channel to unsubscribe from
 */
export function unsubscribeFromChannel(channelName: string) {
  const { toggleSubscription } = useSubscription();

  const channel = activeChannels.get(channelName);
  if (channel) {
    console.log(`Unsubscribing from channel: ${channelName}`);
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
    toggleSubscription(channelName, false);
  }
}

/**
 * Subscribe to slide updates for a specific session
 * @param sessionId Session ID to subscribe to
 * @param onSlideUpdate Callback for slide updates
 * @param onShapeUpdate Callback for shape updates
 */
export function subscribeToSlideUpdates(
  sessionId: string,
  onSlideUpdate: (payload: any) => void,
  onShapeUpdate: (payload: any) => void
) {
  const slidesChannelName = `slides-${sessionId}`;
  const shapesChannelName = `shapes-${sessionId}`;

  // Subscribe to slides table changes
  subscribeToChannel(slidesChannelName, (payload) => {
    if (payload.table === 'slides' && payload.new?.session_id === sessionId) {
      onSlideUpdate(payload);
    }
  });

  // Subscribe to slide_shapes table changes
  subscribeToChannel(shapesChannelName, (payload) => {
    if (payload.table === 'slide_shapes') {
      onShapeUpdate(payload);
    }
  });
}

/**
 * Unsubscribe from slide updates for a specific session
 * @param sessionId Session ID to unsubscribe from
 */
export function unsubscribeFromSlideUpdates(sessionId: string) {
  unsubscribeFromChannel(`slides-${sessionId}`);
  unsubscribeFromChannel(`shapes-${sessionId}`);
}

/**
 * Clean up all active subscriptions
 */
export function cleanupAllSubscriptions() {
  const { clearAllSubscriptions } = useSubscription();

  console.log('Cleaning up all subscriptions');
  
  // Remove all channels
  activeChannels.forEach((channel, channelName) => {
    supabase.removeChannel(channel);
    console.log(`Removed channel: ${channelName}`);
  });

  // Clear the map and state
  activeChannels.clear();
  clearAllSubscriptions();
} 