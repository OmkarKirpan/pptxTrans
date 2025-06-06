import { useNetwork, useOfflineQueue } from '../index';

/**
 * Initialize network event listeners for online/offline detection
 * This should be called once during app initialization
 */
export function initializeNetworkListeners() {
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  const { setOnline } = useNetwork();
  const { processQueue } = useOfflineQueue();

  // Set initial online status
  setOnline(navigator.onLine);

  // Listen for online/offline events
  const handleOnline = () => {
    console.log('Network: Online');
    setOnline(true);
    // Process any queued operations when coming back online
    processQueue();
  };

  const handleOffline = () => {
    console.log('Network: Offline');
    setOnline(false);
  };

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
} 