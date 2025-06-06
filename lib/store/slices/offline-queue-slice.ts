import { StateCreator } from 'zustand';
import { OfflineQueueState, QueuedOperation } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Initial state for offline queue
const initialState: Omit<OfflineQueueState, 'addOperation' | 'removeOperation' | 'processQueue' | 'clearQueue'> = {
  operations: []
};

export const createOfflineQueueSlice: StateCreator<
  OfflineQueueState,
  [],
  [],
  OfflineQueueState
> = (set, get) => ({
  ...initialState,

  /**
   * Add an operation to the queue
   * @param action Action name
   * @param params Action parameters
   */
  addOperation: (action: string, params: any) => {
    const operation: QueuedOperation = {
      id: uuidv4(),
      action,
      params,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    set(state => ({
      operations: [...state.operations, operation]
    }));
  },

  /**
   * Remove an operation from the queue
   * @param id Operation ID
   */
  removeOperation: (id: string) => {
    set(state => ({
      operations: state.operations.filter(op => op.id !== id)
    }));
  },

  /**
   * Process the queue of operations
   * Attempts to execute queued operations in order
   */
  processQueue: async () => {
    const { operations } = get();
    if (operations.length === 0) return;

    // Process operations in FIFO order
    const sortedOperations = [...operations].sort((a, b) => a.timestamp - b.timestamp);

    for (const operation of sortedOperations) {
      try {
        // Here we would actually execute the operation
        // This is a placeholder - in a real implementation, you'd need to
        // access the store methods based on the operation.action string
        
        console.log(`Executing queued operation: ${operation.action}`);
        
        // If successful, remove from queue
        get().removeOperation(operation.id);
      } catch (error) {
        console.error(`Error processing queued operation:`, error);
        
        // Increment retry count if under max retries
        if (operation.retryCount < operation.maxRetries) {
          set(state => ({
            operations: state.operations.map(op => 
              op.id === operation.id 
                ? { ...op, retryCount: op.retryCount + 1 } 
                : op
            )
          }));
        } else {
          // If max retries reached, remove the operation
          get().removeOperation(operation.id);
          console.error(`Operation ${operation.action} exceeded max retries and was removed`);
        }
      }
    }
  },

  /**
   * Clear all operations from the queue
   */
  clearQueue: () => {
    set({ operations: [] });
  }
}); 