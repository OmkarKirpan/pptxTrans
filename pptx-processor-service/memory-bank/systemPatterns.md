# System Patterns

## Architecture Overview

### Current Implementation
The PPTX Processor Service currently follows a microservice architecture but with implementation gaps:

```
┌─────────────────┐     ┌───────────────┐     ┌────────────────┐
│  API Layer      │────▶│ Service Layer │────▶│ Storage Layer  │
│  (FastAPI) ✓    │     │ (Partial) ⚠️   │     │ (Supabase) ✓   │
└─────────────────┘     └───────────────┘     └────────────────┘
        ▲                       │                     
        │                       ▼                     
        │              ┌───────────────┐              
        └──────────────│  Task Queue   │ (Not needed)
                       │  (Celery) ❌   │
                       └───────────────┘
```

### Simplified Architecture (Recommended)
Based on user requirements for a simple working app:

```
┌─────────────────┐     ┌────────────────┐     ┌────────────────┐
│  API Layer      │────▶│ PPTX Processor │────▶│ Storage Layer  │
│  (FastAPI)      │     │ (Direct)       │     │ (Supabase)     │
└─────────────────┘     └────────────────┘     └────────────────┘
```

## Current Implementation Status

### ✓ Implemented Patterns
1. **FastAPI Structure**: Proper separation of routes, services, models
2. **Dependency Injection**: Using FastAPI's dependency system
3. **Data Models**: Well-defined Pydantic schemas
4. **Service Layer**: Basic structure exists

### ⚠️ Partially Implemented
1. **Repository Pattern**: Supabase integration exists but not fully utilized
2. **Error Handling**: Basic structure exists but needs improvement

### ❌ Not Implemented / Issues
1. **Actual PPTX Processing**: Only mock/placeholder implementation
2. **Task Queue**: Overly complex for requirements (Celery/Redis)
3. **SVG Generation**: Placeholder only, no real conversion

## Core Design Patterns (Revised)

### Direct Processing Pattern (Recommended)
- Remove Celery/Redis dependency
- Use FastAPI's BackgroundTasks for async operations
- Direct processing for immediate response

### Service Layer Pattern
- Simplify to focus on core functionality:
  - `PPTXService`: Handle PPTX parsing and conversion
  - `StorageService`: Handle Supabase uploads
  - `TextExtractionService`: Extract text with positioning

### Data Flow (Simplified)

1. **Input Processing**:
   - Receive PPTX file via API or Supabase reference
   - Validate file format

2. **Slide Processing**:
   - Parse PPTX using python-pptx
   - Extract slide content and structure
   - Generate SVG representation
   - Extract text with positioning data

3. **Output Generation**:
   - Create SVG files for each slide
   - Generate metadata for frontend
   - Upload to Supabase if needed
   - Return structured response

## Implementation Gaps

### Critical Missing Components
1. **PPTX to SVG Conversion**: No actual implementation
   - Current: Placeholder SVG generation
   - Needed: Real conversion logic

2. **Text Positioning**: Simplified implementation
   - Current: Basic coordinate extraction
   - Needed: Accurate positioning for all elements

3. **Windows Compatibility**: Cairo dependency issue
   - Current: Requires manual Cairo installation
   - Needed: Cross-platform solution

## Recommended Architecture Changes

1. **Remove Complexity**:
   - Eliminate Celery/Redis requirement
   - Use simple async processing

2. **Focus on Core**:
   - Implement actual PPTX conversion
   - Ensure Windows compatibility
   - Match frontend requirements

3. **Simplify Dependencies**:
   - Replace CairoSVG with alternative
   - Use python-pptx for extraction
   - Consider Pillow for image generation 