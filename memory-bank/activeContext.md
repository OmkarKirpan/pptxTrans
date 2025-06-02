# Active Context: PowerPoint Translator App

## 1. Current Work Focus
The primary focus is on implementing a full-stack solution for high-fidelity slide rendering and translation, with two main components:

1. **PPTX Processor Service:** A Python FastAPI microservice for server-side PPTX processing
   - Converting slides to SVGs using LibreOffice
   - Extracting text elements and their coordinates
   - Storing processed data in Supabase

2. **Frontend Slide Editor:** Refining the slide rendering and text editing interface
   - Displaying SVG backgrounds with interactive HTML overlays for text editing
   - Implementing the complete data flow from upload to editing

## 2. Recent Changes & Accomplishments
- **PPTX Processor Service Implementation:**
  - Created a standalone Python FastAPI service with endpoints for PPTX processing
  - Implemented `/v1/process` endpoint for handling PPTX uploads and conversion
  - Added background task processing for asynchronous handling of potentially long-running conversions
  - Integrated LibreOffice for high-quality SVG conversion
  - Added text extraction with coordinate data
  - Implemented Supabase integration for storage and database updates

- **Database Schema:** Successfully defined and created `slides` and `slide_shapes` tables in Supabase, including RLS policies and `updated_at` triggers.

- **Type Definitions:** Updated TypeScript types (`ProcessedSlide`, `SlideShape`) to align with the new database schema and the data required for the high-fidelity rendering approach.

- **`SlideCanvas` Refactor:**
  - Modified `SlideCanvas` to expect a `ProcessedSlide` object
  - It now renders an SVG image (from `slide.svg_url`) as the background
  - It overlays interactive, transparent `div`s for text shapes based on coordinates stored in `SlideShape` objects
  - Click handlers on these overlays trigger a text editing dialog

## 3. Next Immediate Steps
1. **Connect Frontend to PPTX Processor Service:**
   - Update the `UploadWizard` to send uploaded PPTX files to the processor service
   - Add polling or webhook mechanism to track processing status
   - Display processing progress to users

2. **Refine Slide Editor Data Flow:**
   - Update `SlideNavigator` to use actual SVGs from processed slides
   - Implement proper data fetching from Supabase in `editor/[sessionId]/page.tsx`
   - Enhance text editing dialog with additional features (font size, basic formatting)

3. **Environment Configuration:**
   - Setup proper deployment environment for the PPTX Processor Service
   - Configure integration between Next.js frontend and processor service

4. **Translation Session Management:**
   - Implement complete session lifecycle from creation to export
   - Add functionality to track translation progress

## 4. Active Decisions & Considerations
- **Architecture Choice:** The decision to use a separate microservice for PPTX processing rather than trying to handle it within Next.js serverless functions is confirmed as the right approach, given the specialized requirements (LibreOffice, complex file processing).

- **Processing Pipeline:** The current pipeline using LibreOffice for SVG generation provides the best visual fidelity. We've implemented a backup approach using Python libraries for cases where LibreOffice might not be available.

- **Coordinate System:** Using percentages relative to original slide dimensions for positioning text overlays ensures responsive behavior across different screen sizes.

- **Error Handling:** Robust error handling is crucial throughout the pipeline, especially for the asynchronous PPTX processing step and data fetching in the editor.

- **Performance Considerations:** 
  - Monitor SVG rendering performance, especially for complex slides
  - Consider optimization techniques for presentations with many slides
  - Implement proper cleanup of temporary files in the processor service
