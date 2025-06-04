# System Patterns: PowerPoint Translator App

## 1. Overall Architecture
- **Microservice Architecture:** The application consists of three main components:
  1. **Next.js Frontend:** Handles user interface, authentication, and client-side interactions
  2. **Python FastAPI PPTX Processor Service:** Manages PPTX conversion, SVG generation, and text extraction
  3. **Go Audit Service:** Provides a read-only API for accessing translation session audit logs
- **Supabase BaaS:** Used by all components for authentication, database, and file storage
- **Asynchronous Processing:** Heavy PPTX processing tasks are handled asynchronously with job status tracking

## 2. Authentication Flow
- Standard email/password authentication managed by Supabase Auth
- Client-side Supabase SDK handles user sessions and authentication state
- Protected routes in Next.js redirect unauthenticated users to the login page
- Backend services validate Supabase JWT tokens for secure access
- The Audit Service supports both JWT authentication and share token validation

## 3. Data Management & Storage
- **PostgreSQL Database (Supabase):**
    - `translation_sessions`: Stores metadata for each translation project
    - `slides`: Stores metadata for each slide within a session, including the URL to its SVG representation and original dimensions
    - `slide_shapes`: Stores data for each text element (and potentially other shape types) on a slide, including original/translated text, coordinates, and basic styling
    - `audit_logs`: Stores detailed audit entries for all session activities
    - `session_shares`: Stores share tokens for accessing sessions
- **Supabase Storage:**
    - `presentations` (or similar bucket): Stores uploaded original PPTX files
    - `slide_visuals`: Stores server-generated SVG files for each slide
    - `processing-results`: Stores JSON result files with processed data
- **Row Level Security (RLS):** Implemented on Supabase tables to ensure users can only access and modify their own data

## 4. PPTX Processing Pipeline
1. **Upload:** User uploads a PPTX file via the `UploadWizard` in the Next.js frontend
2. **Session Creation:** A `translation_sessions` record is created in Supabase
3. **Processing Request:** The frontend makes a request to the Python processor service `/v1/process` endpoint with the PPTX file and session metadata
4. **Background Processing:** The processor service:
   - Saves the file temporarily
   - Queues a background task for processing
   - Returns a job ID and estimated completion time
5. **PPTX Conversion:**
   - The processor converts each slide to SVG using LibreOffice (with ElementTree fallback)
   - Text elements, their content, coordinates, and styling are extracted
   - SVGs are uploaded to Supabase Storage
   - Slide metadata and text elements are saved to Supabase database tables
6. **Status Tracking:** The frontend periodically polls the processor's status endpoint to check progress
7. **Completion:** Once processing is complete, the frontend can navigate to the editor

## 5. Audit Logging System
The Audit Service provides a dedicated microservice for tracking and retrieving audit logs for translation sessions:

1. **Log Generation:** Activities performed by users (edit, comment, share, etc.) generate audit log entries in the `audit_logs` table
2. **Log Structure:** Each audit entry contains:
   - Session ID and User ID
   - Type (create, edit, merge, comment, etc.) - consistent field naming using 'type' across frontend and backend
   - Timestamp
   - Detailed JSON payload with action-specific data
   - IP address and user agent information

3. **Access Control:**
   - Session owners have full access to view all audit logs
   - Users with share tokens have limited access based on permissions
   - JWT validation ensures secure access to audit data

4. **API Endpoints:**
   - `/api/v1/sessions/:sessionId/history`: Retrieves paginated audit logs for a specific session
   - `/api/v1/events`: Creates new audit events with type and details

5. **Data Integrity:**
   - Audit logs are immutable once created
   - Historical data is preserved for accountability and tracking

6. **Frontend Integration:**
   - `AuditQueueService` handles reliable submission of audit events with offline support and retries
   - `AuditServiceClient` provides direct API communication
   - `useAuditLog` React hook for components to log events and retrieve history
   - Consistent field naming convention using 'type' instead of 'action' for event categorization

7. **Test Session Support:**
   - Special "test-*" session ID pattern for development and testing
   - In-memory storage for test events
   - Bypasses authentication requirements

8. **Audit Integration Pattern:** (NEW)
   - **Component-Level Integration:** Components use the `useAuditLog` hook to access audit functionality
   - **Enhanced Data Capture:** UI components like `SlideCanvas` pass detailed data to event handlers for comprehensive audit logs
   - **Offline-First Approach:** Events are queued locally before sending to ensure no data loss during connectivity issues
   - **Graceful Degradation:** Audit failures don't block user actions but are retried in the background
   - **Centralized Event Creation:** All audit events flow through the `createAuditEvent` function from the hook
   - **Event Types Standardization:** Using consistent event types across all components (`view`, `edit`, `export`, etc.)

## 6. PPTX Processor Service Architecture
The processor service follows a clean architecture pattern:

1. **API Layer (`app/api/routes/`):**
   - `processing.py`: Handles file uploads and initiates processing
   - `status.py`: Provides job status and results endpoints
   - `health.py`: Service health monitoring

2. **Service Layer (`app/services/`):**
   - `pptx_processor.py`: Core processing logic, orchestrates the conversion pipeline
   - `job_status.py`: Manages processing job status with in-memory and file-based storage
   - `supabase_service.py`: Handles interaction with Supabase (storage, database)
   - `results_service.py`: Manages retrieval and reconstruction of processing results

3. **Data Models (`app/models/schemas.py`):**
   - `ProcessingResponse`: API response for job initiation
   - `ProcessingStatusResponse`: Status check response
   - `ProcessedPresentation`: Complete presentation data
   - `ProcessedSlide`: Individual slide data
   - `SlideShape`: Text and image element data

4. **SVG Generation System:**
   - **Primary Method:** LibreOffice conversion via subprocess
   - **Fallback Method:** Custom ElementTree-based SVG generation
   - **Hybrid Approach:** Attempts LibreOffice first, falls back to ElementTree if needed

5. **Job Management:**
   - Background tasks using FastAPI's `BackgroundTasks`
   - Status tracking with in-memory dictionary and file-based backup
   - Retry mechanism for failed jobs

## 7. Audit Service Architecture
The Audit Service follows a clean, layered architecture pattern in Go:

1. **API Layer (`internal/handlers/`):**
   - `audit_handler.go`: Handles HTTP requests related to audit logs
   - `events_handler.go`: Handles event creation requests
   - RESTful API with JWT authentication and pagination

2. **Service Layer (`internal/service/`):**
   - `audit_service.go`: Business logic for retrieving and filtering audit logs
   - Handles authorization checks based on user roles and permissions

3. **Repository Layer (`internal/repository/`):**
   - `audit_repository.go`: Data access layer for interacting with Supabase
   - `supabase_client.go`: HTTP client for Supabase REST API

4. **Domain Models (`internal/domain/`):**
   - `audit.go`: Core domain entities (AuditEntry, AuditResponse) with 'Type' field for event type
   - `errors.go`: Domain-specific error types and error handling

5. **Middleware (`internal/middleware/`):**
   - `auth.go`: JWT validation and share token verification
   - `request_id.go`: Request ID generation and tracking
   - `logger.go`: Structured logging
   - `error_handler.go`: Consistent error response formatting

6. **Utility Packages (`pkg/`):**
   - `jwt/`: JWT token validation
   - `cache/`: In-memory caching for tokens
   - `logger/`: Logging utilities

7. **Configuration (`internal/config/`):**
   - Environment-based configuration with reasonable defaults
   - Support for both local development and production environments

## 8. Slide Rendering & Interaction Pattern
1. **Slide Data Fetching:** The editor fetches `ProcessedSlide` data from Supabase (which includes the `svg_url` and an array of `SlideShape` objects)
2. **Canvas Rendering:** The `SlideCanvas` component:
   - Renders the `svg_url` as a background image, maintaining its aspect ratio
   - For each text `SlideShape`, positions a transparent HTML overlay on top of the SVG using the extracted coordinates
   - Makes these overlays interactive, allowing users to click and trigger a text editing dialog
3. **Text Editing:** User edits translations in a dialog. Saved translations update the `translated_text` field in the `slide_shapes` table in Supabase
4. **Audit Logging:** (NEW) User interactions trigger audit events:
   - Loading the editor logs a 'view' event
   - Selecting a slide logs a navigation event
   - Opening the text editor logs a text selection event
   - Saving translated text logs an 'edit' event with before/after values

## 9. UI Structure & State Management
- **Component-Based Architecture:** Utilizing shadcn/ui components and custom React components for modularity and reusability
- **Routing:** Next.js App Router for file-system based routing
- **Client-Side State:** React hooks (`useState`, `useEffect`) for local component state
- **Server Components & Client Components:** Leveraging Next.js App Router features for optimal rendering strategies. Interactive UI elements are Client Components. Data fetching can occur in Server Components

## 10. API Interaction Patterns
- **Next.js to Processor Service:** REST API calls for PPTX processing and status checking
- **Next.js to Audit Service:** REST API calls for fetching audit logs
- **Supabase Client SDK:** Used by frontend and backend services for interaction with Supabase services (Auth, DB, Storage)
- **Next.js Route Handlers:** Used for custom backend logic within the Next.js application
- **Server Actions:** Considered for form submissions and mutations that don't require complex request/response cycles

## 11. Error Handling Strategy
- **Frontend:** Structured error handling with user-friendly error messages
- **PPTX Processor Service:** 
  - Error logging with detailed context information
  - Fallback mechanisms for key components (SVG generation)
  - Job retry capabilities for transient issues
- **Audit Service:**
  - Domain-specific error types mapped to appropriate HTTP status codes
  - Middleware-based error handling for consistent error responses
  - Detailed logging with request IDs for traceability
- **Client-Side Resilience:** Retry logic and fallback UIs for temporary service unavailability
  - `AuditQueueService` implements offline queue and retry mechanism
  - Graceful degradation with informative error messages
  - Recovery strategies for network interruptions
- **Feature Prioritization:** (NEW)
  - Focus on core translation functionality first
  - Implement critical audit logging for key user actions
  - Comments system deferred to future phases
