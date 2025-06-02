# Active Context

## Current Focus
Successfully integrated Supabase for storage and got basic PPTX processing working. The service can now:
- Accept PPTX file uploads
- Process slides using fallback SVG generation (ElementTree)
- Upload SVGs and thumbnails to Supabase storage
- Track job status and allow retrying failed jobs

## Recent Changes
1. **Fixed Critical Bugs**:
   - Slide dimensions now correctly accessed from presentation object
   - MSO_VERTICAL_ANCHOR enum mapping fixed by removing non-existent values
   - Supabase URL validation improved with normalization

2. **Supabase Integration**:
   - Successfully connected to local Supabase instance
   - Created all required database tables
   - Configured storage buckets (slide-visuals, processing-results)
   - Disabled RLS for development to avoid permission issues

3. **Error Handling**:
   - Added graceful handling of storage bucket creation errors
   - Implemented retry mechanism for failed jobs
   - Better logging throughout the process

## Current Issues
1. **LibreOffice**: Conversion command executes but produces no SVG output
   - Might be Windows path or command argument issue
   - Fallback to ElementTree is working fine

2. **Performance**: Need to optimize for larger presentations

## Next Steps
1. Debug LibreOffice SVG generation on Windows
2. Test with various PPTX files to ensure robustness
3. Add production-ready RLS policies
4. Improve error recovery mechanisms
5. Performance optimization for large files

## Technical State
- API running on http://localhost:8000
- Supabase running on http://127.0.0.1:54321
- Storage buckets configured and working
- Database schema implemented
- Background task processing active
- Retry mechanism implemented

## User Workflow
1. Upload PPTX file to `/api/process`
2. Receive job ID and session ID
3. Check status at `/status/status/{job_id}`
4. If failed, can retry with `/status/retry/{job_id}`
5. Get results at `/status/results/{session_id}` when completed

## Active Decisions
- **SVG Visuals (Primary)**: Batch LibreOffice `soffice.exe` call (`_generate_svgs_for_all_slides_libreoffice`) converting all slides at once.
- **SVG Visuals (Fallback)**: ElementTree-based generation (`create_svg_from_slide`) using pre-extracted shape data.
- **Text/Metadata Extraction**: `python-pptx` (via `extract_shapes`), performed once per slide.
- **`LIBREOFFICE_PATH`**: Configurable via `.env` and `app.core.config.settings`.

## Implementation Details for Hybrid Approach
- `process_pptx` function:
    - Checks for configured and valid `settings.LIBREOFFICE_PATH`.
    - Calls `_generate_svgs_for_all_slides_libreoffice` once to get a dictionary mapping slide numbers to SVG paths.
    - Iterates through slides, calling `process_slide` for each.
- `_generate_svgs_for_all_slides_libreoffice` function:
    - Uses `soffice --headless --convert-to svg:"impress_svg_Export" ...`.
    - Manages a temporary directory for LibreOffice output.
    - Attempts to sort and rename/map generated SVGs to `slide_{n}.svg` in the main processing output directory.
    - Returns a dictionary `Dict[int, str]` of slide numbers to SVG paths.
- `process_slide` function:
    - Receives the path to a pre-generated LibreOffice SVG (if available).
    - Calls `extract_shapes` once.
    - If pre-generated SVG is not valid/available, calls `create_svg_from_slide` (passing extracted shapes and background fill).
    - Uploads the chosen SVG.
    - Generates thumbnail using `create_thumbnail_from_slide_pil` (passing extracted shapes).
- `extract_shapes` provides all necessary data for both `ProcessedSlide` model and SVG fallback rendering.

## User Requirements Clarified
- App will take PPTX from frontend or get it from Supabase storage.
- Generate SVG per slide with metadata for text display in slidecanvas frontend component.
- Used for PPTX text translation.
- No security or tests needed - just working functionality (though robustness is being improved).

## Current Questions
- How consistently does `impress_svg_Export` name output files across different LibreOffice versions/OS when converting a whole presentation?
- What is the best strategy if `_generate_svgs_for_all_slides_libreoffice` produces an unexpected number of SVG files (e.g., not matching `slide_count`)? 