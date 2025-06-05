# Active Context

## Current Focus
Implementing simplified LibreOffice-only approach for PPTX processing with enhanced text extraction for translation optimization. The service will focus on:
- Fixing LibreOffice SVG generation in Docker environment
- Enhancing python-pptx text extraction for accurate frontend overlay positioning
- Simplifying architecture by removing hybrid approach complexity
- Creating comprehensive integration documentation for development team

## Recent Changes & Implementation Plan
1. **Architectural Simplification**:
   - Decided to remove ElementTree fallback SVG generation
   - Eliminating CairoSVG, Celery, Redis dependencies
   - Focus on LibreOffice-only approach for SVG generation
   - Docker-first deployment strategy

2. **Enhanced Integration Focus**:
   - Prioritizing seamless frontend slidecanvas integration
   - Optimizing API responses for translation workflows
   - Creating comprehensive documentation for development team
   - Focusing on practical functionality over feature complexity

## Current Implementation Status
- **Phase 1 (In Progress)**: LibreOffice Integration Fix & Simplification
  - Remove hybrid approach complexity ⏳
  - Fix LibreOffice SVG generation in Docker environment ⏳
  - Enhance batch processing reliability ⏳

- **Phase 2 (Planned)**: Python-PPTX Text Extraction Enhancement
  - Improve text positioning accuracy for overlay rendering
  - Create translation-optimized data structures
  - Cross-reference with LibreOffice SVG output

- **Phase 3 (Planned)**: Service Architecture Simplification
  - Remove unnecessary dependencies
  - Streamline processing pipeline
  - Optimize Docker environment

## Current Issues Being Addressed
1. **LibreOffice SVG Generation**: Command executes but produces no output
   - Moving from Windows development to Docker Linux environment
   - Implementing proper headless LibreOffice configuration
   - Adding comprehensive error handling and logging

2. **Text Coordinate Accuracy**: Need precise positioning for frontend overlay
   - Enhancing python-pptx extraction for translation-specific metadata
   - Ensuring coordinate system compatibility with LibreOffice SVG output
   - Adding text bounding box calculations

3. **Architecture Complexity**: Removing unnecessary fallback systems
   - Eliminating ElementTree SVG generation
   - Simplifying error handling to fail gracefully without fallbacks
   - Streamlining dependency management

## Next Immediate Steps
1. **Fix LibreOffice Integration (Phase 1)**:
   - Debug LibreOffice command for proper SVG generation
   - Configure LibreOffice for headless operation in Docker
   - Remove ElementTree and fallback SVG generation code
   - Simplify processing pipeline to single-path approach

2. **Enhance Text Extraction (Phase 2)**:
   - Improve `extract_shapes` function for precise coordinates
   - Add translation-optimized metadata structure
   - Implement text segmentation for better translation units
   - Add coordinate validation against LibreOffice output

3. **Create Integration Documentation (Phase 6)**:
   - API documentation with complete OpenAPI specs
   - Frontend integration guide for slidecanvas component
   - Docker deployment and development setup guide
   - Troubleshooting and error handling documentation

## Technical State
- **API**: Running on FastAPI framework ✓
- **LibreOffice**: Needs configuration fix for SVG generation ❌
- **Supabase**: Connected and working for storage/database ✓
- **Docker**: Environment needs LibreOffice optimization ⚠️
- **Dependencies**: Require cleanup and simplification ⚠️
- **Documentation**: Needs creation for development team integration ❌

## User Workflow (Simplified)
1. Upload PPTX file to `/api/process`
2. LibreOffice batch converts all slides to SVG
3. python-pptx extracts enhanced text metadata for each slide
4. Assets uploaded to Supabase storage
5. Frontend receives structured data for slidecanvas integration
6. Translation interface uses precise coordinates for text overlay

## Active Architectural Decisions
- **SVG Generation**: LibreOffice batch processing only (no fallbacks)
- **Text Extraction**: Enhanced python-pptx with translation optimization
- **Error Handling**: Graceful failure without fallback complexity
- **Deployment**: Docker-first with LibreOffice pre-installed
- **Integration**: API designed specifically for frontend slidecanvas needs
- **Documentation**: Comprehensive guides for development team integration

## Integration Requirements
- **Frontend Compatibility**: API responses optimized for slidecanvas component
- **Translation Focus**: Metadata structured for optimal translation workflows
- **Developer Experience**: Clear documentation and integration patterns
- **Reliability**: Simplified architecture for better maintainability
- **Performance**: Docker optimization for consistent processing speed 