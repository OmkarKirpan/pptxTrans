# Active Context: PowerPoint Translator App

## 1. Current Work Focus
The primary focus is on implementing the high-fidelity slide rendering mechanism within the Slide Editor. This involves:
- Finalizing the database schema for storing processed slide data (SVGs and text element metadata).
- Refactoring the `SlideCanvas` component to display slide SVGs as backgrounds and overlay interactive HTML elements for text editing based on extracted coordinates.
- Defining the data flow from the (conceptual) server-side PPTX processing to the client-side editor.

## 2. Recent Changes & Accomplishments
- **Database Schema:** Successfully defined and created `slides` and `slide_shapes` tables in Supabase, including RLS policies and `updated_at` triggers.
- **Type Definitions:** Updated TypeScript types (`ProcessedSlide`, `SlideShape`) to align with the new database schema and the data required for the high-fidelity rendering approach.
- **`SlideCanvas` Refactor (In Progress):**
    - Modified `SlideCanvas` to expect a `ProcessedSlide` object.
    - It now renders an SVG image (from `slide.svg_url`) as the background.
    - It overlays interactive, transparent `div`s for text shapes based on coordinates stored in `SlideShape` objects.
    - Click handlers on these overlays are set up to trigger a text editing dialog.
- **Conceptual API Design:** Outlined the structure and responsibilities of a server-side API route (`/api/process-pptx`) that would handle PPTX to SVG conversion and data extraction. Acknowledged that the actual conversion logic is external to the Next.js Lite environment.
- **Editor Page Structure:** The `app/editor/[sessionId]/page.tsx` has been updated to use mock `ProcessedSlide` data and integrate the refactored `SlideCanvas`. Basic text editing dialog and mock save functionality (updating local state and attempting Supabase update) are in place.

## 3. Next Immediate Steps
1.  **Update `SlideNavigator`:** Modify the `SlideNavigator` component to:
    - Accept `ProcessedSlide[]` data.
    - Use the `svg_url` from `ProcessedSlide` objects (or a derived thumbnail URL) for displaying slide previews.
    - Correctly handle selection and communicate the `currentSlideId` to the editor page.
2.  **Implement Real Data Fetching in Slide Editor:**
    - In `app/editor/[sessionId]/page.tsx`, replace mock data with actual Supabase calls to:
        - Fetch `translation_sessions` details.
        - Fetch all `ProcessedSlide` data associated with the current session, including their related `SlideShape` data (likely using a Supabase join or separate queries).
3.  **Integrate `UploadWizard` with Processing API (Conceptual Call):**
    - After a PPTX file is successfully uploaded to Supabase Storage and a `translation_sessions` record is created in the `UploadWizard`:
        - Make a `POST` request to the (conceptual) `/api/process-pptx` endpoint, passing the `sessionId` and the `original_file_path` of the PPTX in Supabase Storage.
        - Implement UI feedback for the processing state (e.g., "Processing presentation..."). Since the actual processing is asynchronous and external, this might involve polling or listening to Supabase Realtime events for completion.
4.  **Refine and Test Text Editing Persistence:**
    - Ensure that saving translations in the text editing dialog reliably updates the `translated_text` field in the `slide_shapes` table in Supabase.
    - Handle potential errors during the save operation and provide appropriate user feedback.

## 4. Active Decisions & Considerations
- **Commitment to Server-Side SVG Conversion:** The decision to pursue server-side SVG conversion for high visual fidelity is firm. The main challenge remains the implementation/integration of this external processing step.
- **Coordinate System:** Ensuring consistency in how coordinates (`x_coordinate`, `y_coordinate`, `width`, `height`) and their `coordinates_unit` (`percentage` vs. `px`) are handled from extraction to rendering. Percentage-based relative to original slide dimensions is preferred for responsive overlays.
- **Error Handling:** Robust error handling is crucial, especially for the asynchronous PPTX processing step and data fetching in the editor.
- **Performance:** Monitor performance when rendering SVGs and many interactive overlays, especially for presentations with many slides or complex shapes.
