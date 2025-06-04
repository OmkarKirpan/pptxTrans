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
  const { currentSession } = useSession()
  const { slides, currentSlide, setCurrentSlide } = useSlides()
  const { createBuffer, updateBuffer, saveBuffer } = useEditBuffers()
  
  // ...
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

(Coming soon) The store will support persistence for certain slices to enable offline usage and restore application state between sessions.

## Development

### Adding a New Slice

1. Define your slice's state and actions in `types.ts`
2. Create a new file in `slices/` following the naming pattern: `your-domain-slice.ts`
3. Implement your slice using the `StateCreator` pattern
4. Add your slice to the main store in `index.ts`
5. Create custom hooks for accessing your slice

### Best Practices

- Use selectors to access only the state you need
- Keep actions co-located with their respective state
- Use TypeScript for type safety
- Avoid using the store for ephemeral UI state (use local state instead)
- Consider implementing middleware for side effects or persistence 