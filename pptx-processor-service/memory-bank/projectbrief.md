# PPTX Processor Microservice - Project Brief

## Project Purpose
A Python-based microservice for converting PowerPoint (PPTX) presentations to SVGs and extracting text data with positioning information. This service is a critical component of the PowerPoint Translator App, enabling high-fidelity slide rendering and text translation while maintaining visual fidelity.

## Core Requirements (Clarified)
1. Accept PPTX files from frontend or retrieve from Supabase storage
2. Convert PPTX slides to SVG format (one SVG per slide)
3. Extract text elements with precise coordinates and styling information
4. Generate metadata for text display in slidecanvas frontend component
5. Store processed assets in Supabase Storage (optional)
6. Return structured data for frontend translation interface
7. Simple, working implementation without unnecessary complexity

## User Requirements
- **Primary Goal**: Enable PPTX text translation in frontend
- **Input**: PPTX file (from upload or Supabase)
- **Output**: SVG per slide + text metadata for translation
- **Complexity**: Keep it simple - no security, no complex testing, just working functionality
- **Platform**: Must work on Windows development environment

## Tech Stack (Revised)
- **FastAPI**: Web framework for API endpoints ✓
- **Python-PPTX**: Library for parsing PowerPoint files ✓
- **SVG Generation**: Custom implementation (not CairoSVG due to Windows issues)
- **Supabase**: Storage for assets (optional for basic functionality)
- **UV**: Package management tool ✓
- **No Celery/Redis**: Simplified architecture without task queue

## Current State
- **Structure**: Well-organized FastAPI application ✓
- **Dependencies**: Installed but Cairo issue on Windows ❌
- **Core Feature**: Mock implementation only, needs real conversion ❌
- **Architecture**: Overly complex with unnecessary dependencies ⚠️

## Success Criteria
1. Application runs on Windows without dependency issues
2. Can process real PPTX files and generate actual SVGs
3. Extracts text with accurate positioning for frontend
4. Returns metadata in format compatible with slidecanvas component
5. Simple to run and test locally

## Next Steps
1. Replace CairoSVG with alternative SVG generation method
2. Implement actual PPTX to SVG conversion
3. Simplify architecture by removing Celery/Redis
4. Create working demo with real PPTX processing
5. Test with slidecanvas frontend component 