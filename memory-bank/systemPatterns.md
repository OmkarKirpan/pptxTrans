# System Patterns: PowerPoint Translator App

## 1. Overall Architecture
- **Client-Server Model with BaaS:** The frontend is a Next.js application, interacting with Supabase as its Backend-as-a-Service provider for authentication, database, and file storage.
- **Decoupled Slide Processing:** A conceptual server-side API endpoint (`/api/process-pptx`) is responsible for the heavy lifting of PPTX to SVG conversion and data extraction. This service is treated as a black box by the frontend, which uploads the PPTX and then receives structured slide data.

## 2. Authentication Flow
- Standard email/password authentication managed by Supabase Auth.
- Client-side Supabase SDK handles user sessions and authentication state.
- Protected routes in Next.js redirect unauthenticated users to the login page.

## 3. Data Management & Storage
- **PostgreSQL Database (Supabase):**
    - `translation_sessions`: Stores metadata for each translation project.
    - `slides`: Stores metadata for each slide within a session, including the URL to its SVG representation and original dimensions.
    - `slide_shapes`: Stores data for each text element (and potentially other shape types) on a slide, including original/translated text, coordinates, and basic styling.
- **Supabase Storage:**
    - `presentations` (or similar bucket): Stores uploaded original PPTX files.
    - `slide_visuals` (or similar bucket): Stores server-generated SVG files for each slide.
    - (Potentially) `translated_presentations`: Stores exported PPTX files.
- **Row Level Security (RLS):** Implemented on Supabase tables to ensure users can only access and modify their own data.

## 4. Slide Rendering & Interaction Pattern (High-Fidelity Approach)
1.  **Upload:** User uploads a PPTX file via the `UploadWizard`. The file is stored in Supabase Storage.
2.  **Session Creation:** A `translation_sessions` record is created.
3.  **Processing Trigger:** The frontend calls the conceptual `/api/process-pptx` endpoint, providing the path to the uploaded PPTX and the session ID.
4.  **Server-Side Conversion (Conceptual):**
    - The backend service retrieves the PPTX.
    - It converts each slide to an SVG image.
    - It extracts text elements, their content, coordinates (e.g., as percentages of slide dimensions), and basic styling information.
    - Generated SVGs are uploaded to Supabase Storage (`slide_visuals` bucket).
    - Slide metadata (SVG URL, original dimensions) is saved to the `slides` table.
    - Extracted text element data is saved to the `slide_shapes` table, linked to the respective slide.
5.  **Client-Side Display (`SlideCanvas`):**
    - The editor fetches `ProcessedSlide` data (which includes the `svg_url` and an array of `SlideShape` objects).
    - The `SlideCanvas` component renders the `svg_url` as a background image, maintaining its aspect ratio.
    - For each text `SlideShape`, a transparent HTML overlay is positioned absolutely on top of the SVG, using the extracted coordinates.
    - These overlays are interactive, allowing users to click and trigger a text editing dialog.
6.  **Text Editing:** User edits translations in a dialog. Saved translations update the `translated_text` field in the `slide_shapes` table.

## 5. UI Structure & State Management
- **Component-Based Architecture:** Utilizing shadcn/ui components and custom React components for modularity and reusability.
- **Routing:** Next.js App Router for file-system based routing.
- **Client-Side State:** React hooks (`useState`, `useEffect`) for local component state.
- **Server Components & Client Components:** Leveraging Next.js App Router features for optimal rendering strategies. Interactive UI elements are Client Components. Data fetching can occur in Server Components.

## 6. API Interaction
- **Supabase Client SDK:** Used for direct interaction with Supabase services (Auth, DB, Storage) from the client-side and server-side (Route Handlers, Server Actions).
- **Next.js Route Handlers:** Used for custom backend logic, such as the conceptual `/api/process-pptx` endpoint.
- **Server Actions:** Considered for form submissions and mutations that don't require complex request/response cycles.
