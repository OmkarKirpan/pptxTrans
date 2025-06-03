# PPTX Processor Microservice - Product Requirements Document

## 1. Introduction

### 1.1 Purpose
This document outlines the requirements for a Python-based microservice responsible for converting PowerPoint (PPTX) presentations to SVGs and extracting text data with positioning information. This service is a critical component of the PowerPoint Translator App, enabling high-fidelity slide rendering and text translation while maintaining visual fidelity.

### 1.2 Scope
The PPTX Processor Microservice will:
- Receive and process PPTX files
- Convert individual slides to SVG images
- Extract text elements with their coordinates, styles, and other metadata
- Return structured data that integrates with the frontend SlideCanvas component
- Store generated assets in Supabase Storage

### 1.3 Definitions
- **PPTX**: Microsoft PowerPoint Open XML Presentation file format
- **SVG**: Scalable Vector Graphics, an XML-based vector image format
- **Text Element**: A discrete text shape or text box within a PowerPoint slide
- **SlideCanvas**: The frontend React component that displays slides and overlays interactive elements

## 2. Product Overview

### 2.1 Product Perspective
The PPTX Processor Microservice is a standalone service that integrates with the PowerPoint Translator App's frontend. It serves as the backend processing engine that enables the core functionality of high-fidelity slide rendering and text extraction for translation.

### 2.2 User Classes and Characteristics
This microservice does not have direct users but serves the PowerPoint Translator App, which is used by:
- Business professionals preparing multilingual presentations
- Marketing teams localizing campaign materials
- Educational institutions creating content for diverse audiences
- Translation agencies and freelance translators

### 2.3 Operating Environment
- Python-based microservice deployable as a containerized application
- Stateless architecture for horizontal scalability
- Cloud-agnostic design with initial deployment on a suitable cloud platform

## 3. Requirements

### 3.1 Functional Requirements

#### 3.1.1 PPTX Processing
- **FR1.1**: Accept PPTX files via HTTP POST requests
- **FR1.2**: Validate incoming PPTX files for format correctness and security
- **FR1.3**: Support batch processing of multiple PPTX files
- **FR1.4**: Handle PPTX files of varying sizes (up to 50MB initially)

#### 3.1.2 Slide Conversion
- **FR2.1**: Convert each slide in a PPTX to a high-fidelity SVG image
- **FR2.2**: Preserve all visual elements including images, shapes, charts, and special effects
- **FR2.3**: Maintain original slide dimensions and aspect ratio
- **FR2.4**: Optimize SVG output for web display while maintaining quality

#### 3.1.3 Text Extraction
- **FR3.1**: Extract all text elements from each slide
- **FR3.2**: Capture text content for each text element
- **FR3.3**: Determine precise coordinates (x, y, width, height) for each text element
- **FR3.4**: Extract basic styling information (font, size, color, bold, italic, etc.)
- **FR3.5**: Preserve text hierarchy and reading order
- **FR3.6**: Handle special characters and non-Latin scripts
- **FR3.7**: Support text extraction from tables, charts, and SmartArt

#### 3.1.4 Data Storage and Retrieval
- **FR4.1**: Upload generated SVGs to Supabase Storage
- **FR4.2**: Generate unique, consistent file paths for all assets
- **FR4.3**: Return structured data with references to stored assets
- **FR4.4**: Support asynchronous processing with status updates

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance
- **NFR1.1**: Process a typical 30-slide presentation in under 2 minutes
- **NFR1.2**: Support concurrent processing of multiple presentations
- **NFR1.3**: Optimize memory usage for handling large presentations

#### 3.2.2 Reliability
- **NFR2.1**: Achieve 99.9% uptime
- **NFR2.2**: Implement comprehensive error handling and recovery mechanisms
- **NFR2.3**: Provide detailed error reporting

#### 3.2.3 Security
- **NFR3.1**: Implement secure file handling practices
- **NFR3.2**: Sanitize all content to prevent XSS and other security vulnerabilities
- **NFR3.3**: Ensure secure communication with external services

#### 3.2.4 Scalability
- **NFR4.1**: Design for horizontal scalability
- **NFR4.2**: Support auto-scaling based on workload

## 4. Data Requirements

### 4.1 Input Data
- PPTX files
- Processing configuration parameters (session ID, output preferences)
- Authentication information for Supabase access

### 4.2 Output Data
The service will output structured JSON data including:

```json
{
  "session_id": "string",
  "slide_count": "integer",
  "processing_status": "string",
  "slides": [
    {
      "slide_id": "string",
      "slide_number": "integer",
      "svg_url": "string",
      "original_width": "integer",
      "original_height": "integer",
      "thumbnail_url": "string",
      "shapes": [
        {
          "shape_id": "string",
          "shape_type": "string",
          "original_text": "string",
          "x_coordinate": "float",
          "y_coordinate": "float",
          "width": "float",
          "height": "float",
          "coordinates_unit": "string",
          "font_size": "float",
          "font_family": "string",
          "font_weight": "string",
          "font_style": "string",
          "color": "string",
          "reading_order": "integer"
        }
      ]
    }
  ]
}
```

## 5. External Interfaces

### 5.1 User Interfaces
This microservice does not have a direct user interface. It operates as a REST API.

### 5.2 Hardware Interfaces
No specific hardware interfaces required beyond standard server infrastructure.

### 5.3 Software Interfaces
- **SI1**: Supabase Storage API for storing SVGs and other assets
- **SI2**: HTTP/REST API for receiving requests and returning processed data
- **SI3**: Logging and monitoring interfaces for operational visibility

## 6. Technical Requirements

### 6.1 Technology Stack
- **Python**: Core programming language
- **FastAPI**: API framework for building the microservice
- **python-pptx**: For parsing PPTX files
- **CairoSVG/Inkscape/LibreOffice**: For rendering slides to SVG
- **Docker**: For containerization
- **Supabase SDK**: For integrating with Supabase Storage
- **Uvicorn/Gunicorn**: ASGI servers for production deployment

### 6.2 Development Environment
- Modern Python environment (Python 3.10+)
- Docker for containerization
- Automated testing framework
- CI/CD pipeline

## 7. Implementation Strategy

### 7.1 Phased Approach
1. **Phase 1**: Core PPTX parsing and SVG conversion
2. **Phase 2**: Text extraction with basic positioning
3. **Phase 3**: Advanced styling and special element handling
4. **Phase 4**: Performance optimization and scaling

### 7.2 Integration Points
- **Frontend**: The service will be called by the Next.js frontend via the `/api/process-pptx` route
- **Storage**: Generated SVGs will be stored in Supabase Storage
- **Database**: Slide and shape metadata will be structured for insertion into the PowerPoint Translator App's database

## 8. Constraints and Assumptions

### 8.1 Constraints
- Limited ability to perfectly convert all PowerPoint features to SVG
- Processing time proportional to presentation complexity
- Dependency on external libraries for PPTX parsing and rendering

### 8.2 Assumptions
- PPTX files follow standard Microsoft Office format
- Supabase Storage is available and properly configured
- Network bandwidth is sufficient for transferring files

## 9. Acceptance Criteria
1. Successfully converts at least 95% of standard PowerPoint elements to SVG
2. Accurately extracts text with positioning from at least 98% of text elements
3. Meets performance requirements for typical presentations
4. Output format integrates seamlessly with the SlideCanvas component
5. Robust error handling with clear error messages

## 10. Appendices

### 10.1 Glossary
- **PPTX**: Microsoft PowerPoint Open XML Presentation format
- **SVG**: Scalable Vector Graphics
- **API**: Application Programming Interface
- **JSON**: JavaScript Object Notation
- **REST**: Representational State Transfer

### 10.2 References
- Microsoft PowerPoint Open XML Specification
- SVG W3C Specification
- Supabase Storage API Documentation 