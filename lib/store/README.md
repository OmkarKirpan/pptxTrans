# PowerPoint Translator State Management

This directory contains the Zustand state management implementation for the PowerPoint Translator application.

## Overview

We use Zustand for centralized state management with a modular slice-based approach. Each domain of the application has its own slice, making the code more maintainable and testable.

## Store Structure

- **`types.ts`**: Contains TypeScript interfaces for all state slices and related types
- **`index.ts`**: Main store file that combines all slices and exposes custom hooks
- **`slices/`**: Directory containing individual slices for different domains:
  - `session-slice.ts`: Current session, user role, share tokens
  - `slides-slice.ts`: Slides array, current slide, reordering functionality
  - `edit-buffers-slice.ts`: Text edit buffers for tracking unsaved changes
  - `comments-slice.ts`: Comments per shape with loading states
  - `notifications-slice.ts`: Comment notifications and unread counts
  - `merge-slice.ts`: Shape selection for merge operations
  - `share-slice.ts`: Session sharing functionality
  - `translation-sessions-slice.ts`: Translation session management
  - `migration-slice.ts`: Schema migration handling
  - `network-slice.ts`: Online/offline state tracking
  - `offline-queue-slice.ts`: Queue for offline operations
  - `subscription-slice.ts`: Selective subscription management
- **`migrations/`**: Directory containing schema migration files
- **`utils/`**: Utility functions for network listeners and subscription management

## Enhanced Features

### Schema Migration Strategy
The store now includes a comprehensive migration system to handle schema changes:

```tsx
import { useMigration } from '@/lib/store'

function MyComponent() {
  const { currentVersion, registerMigration } = useMigration()
  
  // Register a migration
  registerMigration({
    version: 2,
    up: (state) => ({
      ...state,
      // Apply migration logic
    })
  })
}
```

### Error State Handling
All async operations now include comprehensive error handling:

```tsx
import { useSlides } from '@/lib/store'

function SlideEditor() {
  const { syncStatus, updateShape } = useSlides()
  
  // syncStatus includes error information
  if (syncStatus.error) {
    return <div>Error: {syncStatus.error}</div>
  }
}
```

### Offline Queue
Operations are automatically queued when offline and processed when connectivity is restored:

```tsx
import { useOfflineQueue, useNetwork } from '@/lib/store'

function OfflineIndicator() {
  const { isOnline } = useNetwork()
  const { operations } = useOfflineQueue()
  
  if (!isOnline && operations.length > 0) {
    return <div>{operations.length} operations queued</div>
  }
}
```

### Selective Subscriptions
Real-time subscriptions can be managed selectively for better performance:

```tsx
import { useSubscription } from '@/lib/store'
import { subscribeToSlideUpdates } from '@/lib/store/utils/subscription-manager'

function SlideEditor({ sessionId }) {
  const { activeSubscriptions } = useSubscription()
  
  useEffect(() => {
    subscribeToSlideUpdates(
      sessionId,
      (slideUpdate) => console.log('Slide updated:', slideUpdate),
      (shapeUpdate) => console.log('Shape updated:', shapeUpdate)
    )
    
    return () => unsubscribeFromSlideUpdates(sessionId)
  }, [sessionId])
}
```

## Usage

### Basic Usage

Import the store or specialized hooks directly:

```tsx
import { useAppStore } from '@/lib/store'

function MyComponent() {
  const slides = useAppStore(state => state.slides)
  // ...
}
```

### Domain-Specific Hooks

For better performance and code organization, use the domain-specific hooks:

```tsx
import { useSession, useSlides, useEditBuffers } from '@/lib/store'

function EditorComponent() {
  const { userRole } = useSession()
  const { slides, currentSlide, setCurrentSlide } = useSlides()
  const { createBuffer, updateBuffer, saveBuffer } = useEditBuffers()
  
  // ...
}
```

### Enhanced Hooks

New hooks for accessing enhanced functionality:

```tsx
import { 
  useMigration, 
  useNetwork, 
  useOfflineQueue, 
  useSubscription 
} from '@/lib/store'

function AppStatus() {
  const { currentVersion } = useMigration()
  const { isOnline } = useNetwork()
  const { operations } = useOfflineQueue()
  const { activeSubscriptions } = useSubscription()
  
  // Display app status information
}
```

### Selector Hooks

Some hooks support filtering or computing derived state:

```tsx
import { useComments, useMergeSelection } from '@/lib/store'

function ShapeComponent({ shapeId, slideId }) {
  // Get comments for a specific shape
  const { comments, isLoading } = useComments(shapeId)
  
  // Get selection state for a specific slide
  const { selections } = useMergeSelection(slideId)
  
  // ...
}
```

## State Persistence

The store supports persistence with automatic migration handling:

- **Version Tracking**: Each persisted state includes a version number
- **Migration on Hydration**: Migrations are automatically applied when loading persisted state
- **Selective Persistence**: Only relevant state is persisted to localStorage
- **Network Recovery**: Network listeners are restored on app startup

## Initialization

To properly initialize all enhanced features, call the setup functions in your app:

```tsx
// In your main app component or _app.tsx
import { registerMigrations } from '@/lib/store/migrations'
import { initializeNetworkListeners } from '@/lib/store/utils/network-listeners'

function App() {
  useEffect(() => {
    // Register all migrations
    registerMigrations()
    
    // Set up network listeners
    const cleanup = initializeNetworkListeners()
    
    return cleanup
  }, [])
  
  // ...
}
```

## Development

### Adding a New Slice

1. Define your slice's state and actions in `types.ts`
2. Create a new file in `slices/` following the naming pattern: `your-domain-slice.ts`
3. Implement your slice using the `StateCreator` pattern
4. Add your slice to the main store in `index.ts`
5. Create custom hooks for accessing your slice

### Creating Migrations

1. Create a new migration file in `migrations/` with version number
2. Implement the `up` function to transform the state
3. Register the migration in `migrations/index.ts`
4. Test the migration with different state scenarios

### Best Practices

- Use selectors to access only the state you need
- Keep actions co-located with their respective state
- Use TypeScript for type safety
- Avoid using the store for ephemeral UI state (use local state instead)
- Implement error handling for all async operations
- Use selective subscriptions to optimize performance
- Test migrations thoroughly before deployment 