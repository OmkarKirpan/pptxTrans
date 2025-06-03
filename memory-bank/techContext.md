# Technical Context: PowerPoint Translator App

## 1. Core Technologies
- **Frontend Framework:** Next.js 14 (App Router) with React 18+ and TypeScript.
- **Styling:** Tailwind CSS for utility-first styling, complemented by shadcn/ui for pre-built, accessible components.
- **Backend-as-a-Service (BaaS):** Supabase
    - **Authentication:** Supabase Auth for email/password login and user management.
    - **Database:** Supabase PostgreSQL for storing user data, translation sessions, slide metadata, text elements, and comments.
    - **Storage:** Supabase Storage for hosting original PPTX files, server-generated SVG slide representations, and potentially translated PPTX files.
- **PPTX Processor Service:** Python FastAPI microservice
    - **Core Libraries:** python-pptx for PPTX parsing, LibreOffice for high-quality conversion
    - **Background Processing:** Asynchronous task handling with FastAPI BackgroundTasks
    - **Supabase Integration:** Direct connection to Supabase for storage and database operations
- **Audit Service:** Go microservice for audit log management
    - **Framework:** Gin web framework for REST API endpoints
    - **JWT Validation:** Custom JWT validator with caching
    - **Supabase Integration:** HTTP client for Supabase REST API access
- **State Management:** Primarily React's built-in context and state hooks (`useState`, `useEffect`, `useContext`). Complex global state might later involve Zustand or Jotai if deemed necessary.

## 2. Key Libraries & Tools
- **Server-Side PPTX Processing:**
    - **Python FastAPI:** Framework for building the processor microservice
    - **LibreOffice:** Used in headless mode for high-quality PPTX to SVG conversion
    - **python-pptx:** For parsing PPTX files and extracting text and metadata
    - **xml.etree.ElementTree:** For fallback SVG generation when LibreOffice isn't available
    - **Pillow (PIL):** For image processing and thumbnail generation
    - **Supabase Python SDK:** For storage and database operations from the processor
    - **pydantic:** For data validation and settings management
    - **uvicorn:** ASGI server for running the FastAPI application
- **Audit Service:**
    - **Gin:** Lightweight web framework for Go with middleware support
    - **Zap:** High-performance logging library from Uber
    - **Viper:** Configuration management
    - **jwt-go:** JWT token parsing and validation
    - **go-cache:** In-memory caching for tokens
    - **testify:** Testing framework for Go
    - **Swagger/OpenAPI:** API documentation
    - **mockery:** For generating test mocks
- **Frontend Libraries:**
    - **shadcn/ui:** Component library built on Radix UI for accessible, customizable UI elements
    - **PptxGenJS:** (Planned) For programmatically reconstructing PPTX files during export
    - **Supabase JS SDK:** For authentication, database, and storage operations

## 3. PPTX Processor Service Architecture
- **API Endpoints:**
    - `/v1/process`: Accepts PPTX files for processing
    - `/v1/process/batch`: Handles batch processing of multiple files
    - `/v1/status/{job_id}`: Check status of processing jobs
    - `/v1/results/{session_id}`: Retrieve processing results
    - `/v1/retry/{job_id}`: Retry failed jobs
    - `/v1/health`: Service health check
- **Core Components:**
    - **pptx_processor.py:** Main processing logic
    - **job_status.py:** Job status management with in-memory and file-based storage
    - **supabase_service.py:** Supabase integration
    - **results_service.py:** Result retrieval and reconstruction
- **SVG Generation Strategy:**
    - **Primary:** Batch LibreOffice conversion via subprocess for high-fidelity
    - **Fallback:** Custom ElementTree SVG generation
    - **Text Extraction:** Always uses python-pptx regardless of SVG generation method
- **Data Flow:**
    1. Upload PPTX file
    2. Queue background processing task
    3. Extract slide data and generate SVGs
    4. Upload assets to Supabase Storage
    5. Store metadata in Supabase Database
    6. Update job status
    7. Return results when complete

## 4. Audit Service Architecture
- **API Endpoints:**
    - `/api/v1/sessions/{sessionId}/history`: Retrieve audit history for a session
    - `/api/v1/events`: Create new audit events with 'type' field and details
    - `/health`: Service health check
    - `/docs/*`: Swagger documentation
- **Authentication Methods:**
    - **JWT Tokens:** Validated against Supabase JWT secret
    - **Share Tokens:** For limited access to specific sessions
- **Core Components:**
    - **Handlers:** HTTP request handlers for audit logs
    - **Services:** Business logic for authorization and data access
    - **Repository:** Data access layer for Supabase
    - **Middleware:** Request processing, auth, error handling, logging
    - **Domain Models:** Core business entities and errors
- **Field Naming Convention:**
    - Consistent use of 'type' field (instead of 'action') for event categorization across frontend and backend
    - AuditEntry struct uses Type field in Go
    - TypeScript interfaces use type field in frontend
    - API payloads use 'type' for request/response consistency
- **Frontend Integration:**
    - AuditQueueService: Client-side queue for reliable event submission
    - AuditServiceClient: API client for communicating with the service
    - useAuditLog hook: React hook for logging events and retrieving history
- **Performance Optimizations:**
    - **Token Caching:** In-memory cache for validated tokens
    - **Connection Pooling:** HTTP client connection reuse
    - **Request Timeouts:** Configurable timeouts for external calls
- **Error Handling:**
    - Specific error messages for different failure scenarios
    - Graceful degradation when service is unavailable
    - Client-side retry mechanism for transient failures
- **Deployment:**
    - **Docker Container:** Containerized service with health checks
    - **Graceful Shutdown:** Proper connection and resource cleanup
    - **Environment-based Configuration:** Supports different environments

## 5. Development & Preview Environment
- **v0 AI Assistant:** Code generation and iteration assistance.
- **Next.js Development:** Local development with `next dev`
- **PPTX Processor Service:** Local development with Python virtual environment
    - Requires LibreOffice installation for full functionality
    - Can run with fallback mechanisms for basic development
- **Audit Service:** Local development with Go toolchain
    - Go 1.2x with module support
    - Makefile for common operations (build, test, run)
    - Docker Compose for local environment
- **Next.js Lite (v0 Preview):** The runtime environment for previews generated by v0. This environment has limitations for server-side execution of binaries, requiring the separate microservice approach.

## 6. Technical Constraints & Considerations
- **Microservice Architecture:** The separation of the PPTX processing and audit logging into their own microservices solves the challenges of running specialized tools like LibreOffice, which can't be executed within serverless functions, and provides better separation of concerns.

- **Deployment Complexity:** The microservices require non-serverless environments, making deployment more complex than a standard Next.js application.

- **API Communication:** Efficient and robust communication between the Next.js frontend and the microservices is critical, including proper handling of large file uploads and asynchronous processing.

- **SVG Rendering & Interactivity:** Ensuring accurate and performant rendering of SVGs and interactive overlays for potentially many text elements per slide.

- **Data Consistency:** Keeping client-side state, database records, and file storage in sync, especially during collaborative editing.

- **Scalability:** While the MVP focuses on core features, the architecture should allow for future scaling of users and data. The microservices might need horizontal scaling for handling multiple concurrent operations.

- **Security:** All services must implement proper authentication and authorization checks when accessing Supabase resources.

## 7. PPTX Processor Service Technical Details
- **SVG Generation Methods:**
    - **LibreOffice Approach:** Uses `subprocess.run()` to execute LibreOffice in headless mode with specific command-line arguments to convert PPTX to SVG.
    - **ElementTree Approach:** Uses `xml.etree.ElementTree` to create SVG elements based on the extracted slide data.

- **Text Extraction Process:**
    - Extracts text using `python-pptx` library to access slide objects and shapes.
    - Captures text content, positioning, and styling information.
    - Converts coordinates to percentages relative to slide dimensions for responsive rendering.

- **Job Status Management:**
    - In-memory storage with file-based backup for job status information.
    - Allows checking status via API and retrying failed jobs.

- **Error Handling:**
    - Robust error handling for file operations, LibreOffice execution, and Supabase interactions.
    - Fallback mechanisms when primary methods fail.
    - Detailed error logging for debugging.

- **Configuration Management:**
    - Uses `pydantic_settings.BaseSettings` for strongly-typed configuration from environment variables.
    - Centralizes configuration in `app/core/config.py`.

## 8. Audit Service Technical Details
- **JWT Validation Process:**
    - Verifies token signature using Supabase JWT secret
    - Validates claims (expiry, issuer, audience)
    - Extracts user ID and roles
    - Caches validation results to reduce repeated verification

- **Share Token Validation:**
    - Validates share tokens against Supabase database
    - Checks session-specific permissions
    - Caches validation results with shorter TTL
    - Supports read-only access for reviewers

- **Event Structure:**
    - Consistent event payload format across frontend and backend
    - Uses 'type' field (not 'action') for event categorization
    - Includes sessionId, userId, details, and timestamp
    - Extends with IP and user agent information when available

- **Test Session Support:**
    - Special "test-" prefix for session IDs to identify test sessions
    - Bypasses authentication requirements for easier development
    - Stores events in memory rather than database
    - Documented pattern for frontend developers

- **Middleware Stack:**
    - `RequestID`: Generates and tracks unique request IDs
    - `Logger`: Structured logging with Zap
    - `ErrorHandler`: Consistent error responses
    - `Auth`: Authentication and authorization
    - `Recovery`: Panic recovery

- **Error Categorization:**
    - Domain errors: Internal business logic errors
    - API errors: Client-facing error responses
    - Infrastructure errors: Database, network, etc.

- **Pagination Implementation:**
    - Limit/offset pagination for audit logs
    - Configurable page size limits
    - Total count for UI pagination controls

- **Security Considerations:**
    - No sensitive data in logs
    - Proper JWT validation with expiry checking
    - Rate limiting (to be implemented)
    - Non-root Docker container execution
