# System Patterns: PowerPoint Translator App

## 1. Overall Architecture
- **Microservice Architecture:** The application consists of two main components:
  1. **Next.js Frontend:** Handles user interface, authentication, and client-side interactions
  2. **Python FastAPI Processor Service:** Manages PPTX conversion, SVG generation, and text extraction
- **Supabase BaaS:** Used by both components for authentication, database, and file storage
- **Asynchronous Processing:** Heavy PPTX processing tasks are handled asynchronously with job status tracking

## 2. Authentication Flow
- Standard email/password authentication managed by Supabase Auth
- Client-side Supabase SDK handles user sessions and authentication state
- Protected routes in Next.js redirect unauthenticated users to the login page
- The PPTX processor service validates Supabase credentials for secure storage access

## 3. Data Management & Storage
- **PostgreSQL Database (Supabase):**
    - `translation_sessions`: Stores metadata for each translation project
    - `slides`: Stores metadata for each slide within a session, including the URL to its SVG representation and original dimensions
    - `slide_shapes`: Stores data for each text element (and potentially other shape types) on a slide, including original/translated text, coordinates, and basic styling
- **Supabase Storage:**
    - `presentations` (or similar bucket): Stores uploaded original PPTX files
    - `slide_visuals` (or similar bucket): Stores server-generated SVG files for each slide
    - (Potentially) `translated_presentations`: Stores exported PPTX files
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
   - The processor converts each slide to SVG using LibreOffice (with fallback mechanisms)
   - Text elements, their content, coordinates, and styling are extracted
   - SVGs are uploaded to Supabase Storage
   - Slide metadata and text elements are saved to Supabase database tables
6. **Status Tracking:** The frontend periodically polls the processor's status endpoint to check progress
7. **Completion:** Once processing is complete, the frontend can navigate to the editor

## 5. Slide Rendering & Interaction Pattern
1. **Slide Data Fetching:** The editor fetches `ProcessedSlide` data from Supabase (which includes the `svg_url` and an array of `SlideShape` objects)
2. **Canvas Rendering:** The `SlideCanvas` component:
   - Renders the `svg_url` as a background image, maintaining its aspect ratio
   - For each text `SlideShape`, positions a transparent HTML overlay on top of the SVG using the extracted coordinates
   - Makes these overlays interactive, allowing users to click and trigger a text editing dialog
3. **Text Editing:** User edits translations in a dialog. Saved translations update the `translated_text` field in the `slide_shapes` table in Supabase

## 6. UI Structure & State Management
- **Component-Based Architecture:** Utilizing shadcn/ui components and custom React components for modularity and reusability
- **Routing:** Next.js App Router for file-system based routing
- **Client-Side State:** React hooks (`useState`, `useEffect`) for local component state
- **Server Components & Client Components:** Leveraging Next.js App Router features for optimal rendering strategies. Interactive UI elements are Client Components. Data fetching can occur in Server Components

## 7. API Interaction Patterns
- **Next.js to Processor Service:** REST API calls for PPTX processing and status checking
- **Supabase Client SDK:** Used by both frontend and processor service for interaction with Supabase services (Auth, DB, Storage)
- **Next.js Route Handlers:** Used for custom backend logic within the Next.js application
- **Server Actions:** Considered for form submissions and mutations that don't require complex request/response cycles
- **Webhook Pattern (Potential Future):** The processor service could call a webhook on the Next.js app when processing is complete, as an alternative to polling
