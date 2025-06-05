# Technical Context: PowerPoint Translator App

## 1. Technology Stack

### 1.1 Frontend

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix UI-based components)
- **State Management:** 
  - Zustand (fully implemented with modular slices)
  - Zustand/persist middleware for localStorage persistence
  - Custom real-time synchronization service for Supabase
- **Form Management:** React Hook Form with Zod validation
- **Data Fetching:** SWR for client-side fetching, Server Components for server-side
- **Authentication:** Supabase Auth (JWT-based)
- **API Client:** Custom HTTP client with Axios
- **Image Handling:** Next.js Image component for optimized images
- **File Handling:** React Dropzone for file uploads
- **Icons:** Lucide React icons
- **Animations:** Framer Motion for transitions
- **Internationalization:** next-intl (planned for future)
- **Real-time Updates:** Supabase Realtime with optimistic UI updates

### 1.2 Backend Services

#### 1.2.1 PPTX Processor Service

- **Framework:** FastAPI (Python)
- **Libraries:**
  - python-pptx for PPTX parsing
  - LibreOffice for SVG conversion
  - ElementTree for XML processing
  - Pillow for image processing
  - python-multipart for file uploads
  - aiofiles for async file handling
  - supabase-py for Supabase integration
- **Containerization:** Docker
- **Deployment:** Docker Compose for local dev, Cloud Run for production (planned)

#### 1.2.2 Audit Service

- **Framework:** Gin (Go)
- **Libraries:**
  - go-jwt for JWT validation
  - pgx for PostgreSQL access
  - zap for structured logging
  - validator for request validation
  - testify for testing
  - swaggo for API documentation
- **Containerization:** Docker
- **Deployment:** Docker Compose for local dev, Cloud Run for production (planned)

#### 1.2.3 Share Service (IN DEVELOPMENT)

- **Framework:** Hono.js (TypeScript)
- **Runtime:** Bun.js
- **Libraries:**
  - @supabase/supabase-js for Supabase integration
  - jose for JWT handling
  - zod for validation
  - pino for logging
  - supertest for API testing
- **Containerization:** Docker
- **Deployment:** Docker Compose for local dev, Cloud Run for production (planned)

### 1.3 Backend as a Service (BaaS)

- **Platform:** Supabase
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth (JWT-based)
- **Storage:** Supabase Storage (S3-compatible)
- **Real-time:** Supabase Realtime (Postgres changes)
- **Edge Functions:** Deno-based serverless functions (planned)

## 2. Development Setup

### 2.1 Local Environment

- **Node.js:** v18+ (LTS)
- **Package Manager:** npm or bun
- **Docker:** Required for backend services
- **IDE:** VS Code with TypeScript and Tailwind extensions
- **Git:** For version control
- **Environment Management:** dotenv for environment variables
- **Linting:** ESLint with TypeScript support
- **Formatting:** Prettier
- **Testing:** Jest and React Testing Library (planned)

### 2.2 Local Services

- **Supabase:** Local development with Supabase CLI
- **Backend Services:** Dockerized with Docker Compose
- **Database:** PostgreSQL (via Supabase)
- **Redis:** For caching (planned)

## 3. Code Organization

### 3.1 Frontend Structure

```
app/                   # Next.js App Router structure
  api/                 # API routes
  auth/                # Authentication pages
  dashboard/           # Dashboard pages
  editor/              # Slide editor pages
  (...)
components/            # React components
  dashboard/           # Dashboard-specific components
  editor/              # Editor-specific components
    sync-status-indicator.tsx  # Real-time sync status component
    slide-canvas.tsx           # Slide rendering component
    comments-panel.tsx         # Comments panel component
    slide-navigator.tsx        # Slide navigation component
  ui/                  # shadcn/ui components
hooks/                 # Custom React hooks
lib/                   # Utility functions and services
  api/                 # API client functions
  services/            # Service integrations
    realtime-sync.ts   # Supabase real-time sync service
  store/               # Zustand store
    index.ts           # Main store creation with persistence
    types.ts           # Type definitions
    slices/            # Store slices
      session-slice.ts
      slides-slice.ts       # Enhanced with optimistic updates
      edit-buffers-slice.ts
      comments-slice.ts
      notifications-slice.ts
      merge-slice.ts
  supabase/            # Supabase client configuration
public/                # Static assets
styles/                # Global styles
types/                 # TypeScript type definitions
```

### 3.2 PPTX Processor Service Structure

```
app/
  api/                 # API endpoints
    routes/            # Route handlers
  core/                # Core processing logic
  models/              # Data models
  services/            # External service integrations
job_status/            # Job status tracking
tests/                 # Test files
```

### 3.3 Audit Service Structure

```
cmd/
  server/              # Application entry point
internal/
  config/              # Configuration
  domain/              # Domain models
  handlers/            # HTTP handlers
  middleware/          # HTTP middleware
  repository/          # Data access
  service/             # Business logic
pkg/                   # Shared packages
  cache/               # Caching utilities
  jwt/                 # JWT handling
  logger/              # Logging utilities
tests/                 # Test files
```

## 4. Key Data Structures

### 4.1 Slide Processing Data Model

```typescript
interface ProcessedSlide {
  id: string;
  session_id: string;
  slide_number: number;
  svg_url: string;
  original_width: number;
  original_height: number;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  shapes: SlideShape[];
}

interface SlideShape {
  id: string;
  slide_id: string;
  shape_type: 'text' | 'image' | 'table' | 'chart';
  content: string;
  translated_content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_title: boolean;
  font_size?: number;
  font_family?: string;
  style?: string;
  created_at: string;
  updated_at: string;
}
```

### 4.2 Session Data Model

```typescript
interface Session {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  source_language: string;
  target_language: string;
  status: 'processing' | 'ready' | 'completed';
  thumbnail_url?: string;
  slide_count: number;
  created_at: string;
  updated_at: string;
}

interface SessionShare {
  id: string;
  session_id: string;
  share_token: string;
  role: 'reviewer' | 'viewer';
  email?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}
```

### 4.3 Audit Log Data Model

```typescript
interface AuditLog {
  id: string;
  session_id: string;
  user_id: string;
  type: string;
  data: Record<string, any>;
  created_at: string;
}
```

### 4.4 Zustand Store Model

```typescript
// Main store structure
interface AppStore extends 
  SessionState, 
  SlidesState, 
  EditBuffersState, 
  CommentsState, 
  NotificationsState,
  MergeState {}

// Session slice
interface SessionState {
  currentSession: Session | null;
  userRole: UserRole;
  shareToken: string | null;
  setCurrentSession: (session: Session | null) => void;
  setUserRole: (role: UserRole) => void;
  setShareToken: (token: string | null) => void;
}

// Slides slice with sync capabilities
interface SlidesState {
  slides: ProcessedSlide[];
  currentSlideIndex: number;
  isLoading: boolean;
  syncStatus: SyncStatus; // Added for real-time sync
  reorderState: SlideReorderState | null;
  setSlides: (slides: ProcessedSlide[]) => void;
  setCurrentSlideIndex: (index: number) => void;
  updateSlide: (slideId: string, data: Partial<ProcessedSlide>) => void;
  updateShape: (slideId: string, shapeId: string, data: Partial<SlideShape>) => Promise<void>; // Async for server sync
  setSyncStatus: (status: Partial<SyncStatus>) => void; // Manage sync state
  syncSlidesOrder: (slides: ProcessedSlide[]) => Promise<void>; // Sync slide order with server
  startReorder: (sourceIndex: number) => void;
  moveSlide: (targetIndex: number) => void;
  finishReorder: () => void;
}

// Sync status interface
interface SyncStatus {
  isSyncing: boolean;
  lastSynced: string | null;
  error: string | null;
}

// Edit buffers slice
interface EditBuffersState {
  editBuffers: Record<string, EditBuffer>;
  createEditBuffer: (shapeId: string, initialText: string) => void;
  updateEditBuffer: (shapeId: string, text: string) => void;
  saveEditBuffer: (shapeId: string) => void;
  discardEditBuffer: (shapeId: string) => void;
  hasUnsavedChanges: (shapeId: string) => boolean;
}

// Comments slice
interface CommentsState {
  comments: Record<string, Comment[]>;
  isLoadingComments: Record<string, boolean>;
  loadComments: (shapeId: string) => void;
  addComment: (shapeId: string, content: string) => void;
  updateComment: (shapeId: string, commentId: string, content: string) => void;
  deleteComment: (shapeId: string, commentId: string) => void;
}

// Notifications slice
interface NotificationsState {
  notifications: CommentNotification[];
  unreadCount: number;
  addNotification: (notification: CommentNotification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

// Merge slice
interface MergeState {
  selectedShapes: MergeSelection[];
  targetSlideId: string | null;
  selectShape: (slideId: string, shapeId: string) => void;
  deselectShape: (slideId: string, shapeId: string) => void;
  setTargetSlide: (slideId: string) => void;
  clearSelection: () => void;
  mergeSelected: () => void;
}
```

## 5. API Endpoints

### 5.1 Next.js API Routes

- `/api/sessions` - Session management
- `/api/slides` - Slide management
- `/api/process-pptx` - PPTX upload and processing
- `/api/export` - Export translated presentation
- `/api/share` - Share session with others
- `/api/audit` - Fetch audit logs

### 5.2 PPTX Processor Service API

- `/v1/process` - Process PPTX file
- `/v1/status/:job_id` - Get job status
- `/v1/retry/:job_id` - Retry failed job
- `/v1/health` - Health check endpoint

### 5.3 Audit Service API

- `/api/v1/audit/:session_id` - Get audit logs for session
- `/api/v1/health` - Health check endpoint

## 6. Authentication Flow

1. User signs in with email/password or social provider via Supabase Auth
2. Supabase returns JWT token and refresh token
3. JWT token is stored in browser (cookie or localStorage)
4. Token is used for API requests to Supabase and backend services
5. For shared sessions, a share token is generated and used for limited access

## 7. Technical Constraints

### 7.1 Frontend Constraints

- **Browser Support:** Modern browsers only (Chrome, Firefox, Safari, Edge)
- **Mobile Support:** Responsive design but limited editing functionality on small screens
- **Performance:** Large presentations may require pagination or virtualization
- **Offline Support:** Limited offline capabilities with local storage

### 7.2 Backend Constraints

- **PPTX Processing:** LibreOffice availability for high-quality SVG generation
- **Deployment:** Docker support required for services
- **Scalability:** Stateless design for horizontal scaling
- **Storage:** File size limits for presentations (50MB initial limit)

### 7.3 Supabase Constraints

- **Database:** PostgreSQL limitations and row-level security constraints
- **Storage:** File size and bandwidth limits based on plan
- **Authentication:** Limited to supported providers
- **Edge Functions:** Cold start latency

## 8. Performance Considerations

### 8.1 Frontend Performance

- **Lazy Loading:** Components and resources loaded on demand
- **Image Optimization:** Next.js Image component for optimized delivery
- **State Management:** 
  - Selective re-rendering with Zustand selectors
  - Optimistic updates for faster perceived performance
  - Persistent state to reduce initialization time
  - Partialize function to limit storage size
- **Code Splitting:** Next.js automatic code splitting
- **Server Components:** Reduced client-side JavaScript
- **Real-time Sync:** Efficient subscription management with cleanup
- **LocalStorage Optimization:** Storing only necessary state

### 8.2 Backend Performance

- **Caching:** JWT validation cache in Audit Service
- **Background Processing:** Asynchronous PPTX processing
- **Database Optimization:** Proper indexing and query optimization
- **File Handling:** Stream processing for large files

## 9. Testing Strategy

### 9.1 Frontend Testing

- **Unit Tests:** Jest for utility functions and hooks
- **Component Tests:** React Testing Library for components
- **Integration Tests:** Testing component interactions
- **E2E Tests:** Cypress for critical user journeys

### 9.2 Backend Testing

- **Unit Tests:** Service and repository layer testing
- **Integration Tests:** API endpoint testing with test database
- **Mock Tests:** External service mocking

## 10. Deployment Strategy

### 10.1 Frontend Deployment

- **Development:** Local Next.js development server
- **Production:** Vercel or similar platform with CI/CD integration

### 10.2 Backend Deployment

- **Development:** Docker Compose for local services
- **Production:** Cloud Run or similar container platform
- **Database:** Managed PostgreSQL via Supabase

### 10.3 Environment Management

- **Environment Variables:** Managed per environment
- **Secrets:** Secure storage in platform services
- **Configuration:** Environment-specific settings

## 11. Monitoring and Logging

### 11.1 Frontend Monitoring

- **Error Tracking:** Sentry or similar service
- **Analytics:** Google Analytics or similar
- **Performance Monitoring:** Web Vitals tracking

### 11.2 Backend Monitoring

- **Logging:** Structured logging with correlation IDs
- **Metrics:** Prometheus or similar for service metrics
- **Alerting:** Based on error rates and performance thresholds

## 12. Security Considerations

### 12.1 Authentication and Authorization

- **JWT Validation:** Proper verification with expiration checking
- **Role-Based Access:** Enforced at API and database levels
- **Share Token Security:** Limited-scope access with expiration

### 12.2 Data Security

- **Database Security:** Row-level security policies
- **API Security:** Input validation and sanitization
- **File Security:** Secure upload handling and storage
