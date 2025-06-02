# Technical Context

## Technologies Used

### Core Framework
- **FastAPI**: Modern, high-performance Python web framework.

### PPTX Processing & SVG Generation
- **LibreOffice (via `subprocess`)**: Primary method for high-fidelity PPTX to SVG conversion. Uses a single batch call (`--convert-to svg:"impress_svg_Export"`) for all slides.
- **`python-pptx`**: For parsing PPTX files, extracting slide content, shapes, text, styles, and metadata.
- **`xml.etree.ElementTree`**: For fallback SVG generation if LibreOffice is unavailable or fails.
- **Pillow (PIL)**: For image processing, including creating thumbnails and handling embedded images.

### Backend and Storage
- **Supabase**: For object storage (PPTX, SVGs, thumbnails) and potentially job status tracking (though currently local).

### Utilities
- **`python-dotenv`**: For managing environment variables.
- **`uv`**: For Python package management (replacing pip).
- **`aiofiles`**: For asynchronous file operations (though current direct use is minimal).

## Current Technical Issues & Considerations

### 1. LibreOffice SVG Output Mapping
-   **Issue**: The `impress_svg_Export` filter's output file naming/numbering when converting a whole presentation needs to be robustly mapped to slide numbers. Current logic assumes sorted output matches slide order if file count is correct.
-   **Mitigation**: Logging is in place. Further testing across LibreOffice versions/OS is needed. If mapping fails, the system falls back to per-slide ElementTree generation.

### 2. Performance of Batch LibreOffice Conversion
-   **Consideration**: While more efficient than per-slide calls, a single batch call for very large presentations might be long-running or memory-intensive. Timeouts are implemented.
-   **Optimization**: Current approach is a significant improvement. Further parallelization of *independent* tasks (like thumbnail generation after SVGs are ready) could be explored if needed.

### 3. Fallback SVG Fidelity
-   **Limitation**: The ElementTree-based SVG fallback (`create_svg_from_slide`) has inherent limitations in rendering complex PowerPoint features (e.g., intricate SmartArt, some chart types, complex gradients) with perfect visual fidelity compared to LibreOffice.

## Development Setup

### Environment Requirements
-   Python 3.10+
-   LibreOffice (optional but highly recommended for best SVG quality).
-   Supabase account and project (for storage).

### Working Local Development Steps
1.  Clone repository.
2.  Create a Python virtual environment.
3.  Install dependencies: `uv pip install -r requirements.txt`.
4.  Set up a `.env` file based on `env.example` (configure Supabase, `LIBREOFFICE_PATH`, etc.).
5.  Ensure LibreOffice is installed and `LIBREOFFICE_PATH` in `.env` points to the `soffice` executable if using this feature.
6.  Run development server: `uvicorn main:app --reload` (or as per `pyproject.toml`).

### Key Environment Variables (`.env`)
-   `SUPABASE_URL`, `SUPABASE_KEY`: For Supabase integration.
-   `LIBREOFFICE_PATH`: Optional path to `soffice` executable.
-   `LOG_LEVEL`: E.g., `INFO`, `DEBUG`.
-   `TEMP_DIR`: Base directory for temporary processing files (though `TEMP_UPLOAD_DIR`, `TEMP_PROCESSING_DIR` from `app.core.config` are more specific now).

## Technical Constraints & Decisions

### SVG Generation Strategy: Hybrid, Optimized
-   **Primary**: Batch LibreOffice call for all slides for high visual fidelity and efficiency.
-   **Fallback**: `python-pptx` + ElementTree for guaranteed SVG output (lower fidelity for complex elements) if LibreOffice fails or is not configured.
-   **Rationale**: Balances visual quality, robustness, and performance.

### Metadata Extraction
-   Always performed using `python-pptx` (`extract_shapes`) once per slide, irrespective of the SVG generation method used for that slide's visual.

### Asynchronous Operations
-   FastAPI's `BackgroundTasks` are used for the main `process_pptx` task, keeping the API responsive.

### Configuration
-   Key operational parameters (LibreOffice path, Supabase details) are managed via `app.core.config.Settings` loading from `.env`.

## Implemented Technical Stack Summary

-   **API**: FastAPI
-   **PPTX Parsing & Metadata**: `python-pptx`
-   **Primary SVG Rendering**: LibreOffice (`soffice` via `subprocess`)
-   **Fallback SVG Rendering**: `xml.etree.ElementTree`
-   **Image Handling/Thumbnails**: Pillow
-   **Package Management**: `uv`
-   **Configuration**: `python-dotenv`, Pydantic `BaseSettings`
-   **Storage**: Supabase (via `supabase-py` client library)

## Dependencies (Key Libraries)
-   `fastapi`
-   `uvicorn`
-   `python-pptx`
-   `Pillow`
-   `pydantic`
-   `pydantic-settings`
-   `python-dotenv`
-   `supabase`
-   Standard libraries: `os`, `shutil`, `subprocess`, `glob`, `json`, `xml.etree.ElementTree`, `logging`, `asyncio`, `tempfile`. 