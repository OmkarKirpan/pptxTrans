# Active Context

## Current Focus
- Refining and testing the hybrid PPTX to SVG conversion process.
- Ensuring robustness and optimal performance of LibreOffice integration.

## Recent Changes
- **Refactored `pptx_processor.py` for optimization and clarity:**
    - Made `LIBREOFFICE_PATH` configurable via `app.core.config.settings`.
    - Implemented `_generate_svgs_for_all_slides_libreoffice` for efficient batch SVG conversion using a single `soffice` call per presentation.
    - `process_pptx` now orchestrates this batch conversion upfront.
    - `process_slide` now uses pre-generated SVGs if available, otherwise falls back to ElementTree generation.
    - Streamlined `extract_shapes` to be called only once per slide; its output is reused for SVG fallback and the final `ProcessedSlide` model.
    - Improved `create_svg_from_slide` to accept pre-extracted shapes data and slide background fill.
    - Enhanced `create_thumbnail_from_slide_pil` to use extracted shapes, actual slide background (solid fills), and render embedded images.
    - Added `get_slide_background_fill` and `create_minimal_svg` helpers.
    - Improved directory management for processing outputs and cleanup.
    - Removed the old `convert_slide_to_svg_using_libreoffice` (single slide processing with LibreOffice).
- Updated `app.core.config.py` and `env.example` for `LIBREOFFICE_PATH`.

## Critical Issues Being Addressed
- Ensuring the batch LibreOffice conversion correctly maps generated SVGs to slide numbers.
- Verifying performance gains from the batch conversion.
- Maintaining reliability of the fallback ElementTree SVG generation.

## Next Steps
1.  Thoroughly test the refactored `pptx_processor.py` with diverse PPTX files (complex layouts, various elements, large sizes).
2.  Benchmark performance before and after the optimization.
3.  Review and refine error handling, especially for LibreOffice subprocess calls and SVG mapping.
4.  Update detailed documentation for the new processing flow and configuration.
5.  Consider adding more sophisticated slide background extraction if needed (e.g., gradients, images).

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