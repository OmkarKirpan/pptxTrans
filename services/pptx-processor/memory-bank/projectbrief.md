# PPTX Processor Microservice - Project Brief

## Project Purpose
A Python-based microservice for converting PowerPoint (PPTX) presentations to SVGs using LibreOffice and extracting text data with positioning information using python-pptx. This service is a critical component of the PowerPoint Translator App, enabling high-fidelity slide rendering and text translation while maintaining visual fidelity.

## Core Requirements (Updated)
1. Accept PPTX files from frontend or retrieve from Supabase storage
2. Convert PPTX slides to SVG format using LibreOffice (one SVG per slide)
3. Extract text elements with precise coordinates and styling information using python-pptx
4. Generate enhanced metadata optimized for text translation and frontend overlay positioning
5. Store processed assets in Supabase Storage
6. Return structured data compatible with frontend translation interface
7. Simplified LibreOffice-only approach without fallback complexity
8. Docker containerized deployment for consistent environment

## User Requirements
- **Primary Goal**: Enable PPTX text translation in frontend with accurate positioning
- **Input**: PPTX file (from upload or Supabase)
- **Output**: LibreOffice-generated SVG per slide + enhanced text metadata for translation
- **Complexity**: Simplified architecture focusing on reliability over feature complexity
- **Platform**: Docker containerized for consistent deployment across environments
- **Integration**: Smooth integration with Next.js frontend slidecanvas component

## Tech Stack (Simplified)
- **FastAPI**: Web framework for API endpoints ✓
- **LibreOffice**: Primary and only SVG generation method (headless mode) ✓
- **Python-PPTX**: Enhanced text extraction with translation-optimized metadata ✓
- **Supabase**: Storage and database integration ✓
- **UV**: Package management tool ✓
- **Docker**: Containerized deployment with LibreOffice pre-installed ✓
- **No Fallbacks**: Removed ElementTree, CairoSVG, Celery, Redis complexity

## Current State (Updated)
- **Structure**: Well-organized FastAPI application ✓
- **Dependencies**: Streamlined to essential components only
- **Core Feature**: LibreOffice integration needs fixing for SVG generation ❌
- **Architecture**: Simplified to single-path processing ⚠️
- **Text Extraction**: Needs enhancement for translation compatibility ⚠️

## Success Criteria
1. LibreOffice SVG generation works reliably in Docker environment
2. Enhanced text extraction provides accurate coordinates for frontend overlay
3. Seamless integration with frontend slidecanvas component
4. Comprehensive documentation for development team integration
5. Simplified, maintainable codebase without unnecessary complexity
6. Docker deployment ensures consistent behavior across environments

## Next Steps (Implementation Plan)
1. **Phase 1**: Fix LibreOffice integration and remove hybrid approach complexity
2. **Phase 2**: Enhance python-pptx text extraction for translation optimization
3. **Phase 3**: Simplify service architecture and remove unnecessary dependencies
4. **Phase 4**: Implement comprehensive error handling and reliability
5. **Phase 5**: Optimize frontend integration compatibility
6. **Phase 6**: Create complete integration documentation for development team

## Key Architectural Decisions
- **LibreOffice Only**: Single path for SVG generation, no fallbacks
- **Enhanced Text Extraction**: python-pptx optimized for translation workflows
- **Docker First**: Development and deployment in containerized environment
- **Frontend Integration**: API designed specifically for slidecanvas component needs
- **Translation Focus**: All metadata structured for optimal translation experience 