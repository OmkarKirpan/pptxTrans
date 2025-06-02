# PPTX Processor Microservice

A Python-based microservice for converting PowerPoint (PPTX) presentations to SVGs and extracting text data with positioning information. This service is a critical component of the PowerPoint Translator App, enabling high-fidelity slide rendering and text translation while maintaining visual fidelity.

## Features

- Convert PPTX slides to high-quality SVG images
- Extract text elements with precise coordinates and styling information
- Generate slide thumbnails
- Store processed assets in Supabase Storage
- Track processing status and provide detailed progress information
- Asynchronous processing with status updates
- Health monitoring and diagnostics

## Architecture

The microservice is built with:

- **FastAPI**: Modern, high-performance web framework for building APIs
- **Python-PPTX**: Library for parsing PowerPoint files
- **CairoSVG**: SVG rendering and manipulation
- **Supabase**: Backend-as-a-Service for storage and database operations
- **Celery** (conceptual): Task queue for handling asynchronous processing

## API Documentation

API documentation is available at:

- Swagger UI: `/docs`
- ReDoc: `/redoc`

The API follows the OpenAPI 3.1.0 specification, which can be found in [docs/openapi.yaml](./docs/openapi.yaml).

## Getting Started

### Prerequisites

- Python 3.10+
- Docker (optional, for containerized deployment)
- Supabase account and project

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pptx-processor-service
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

### Running the Service

#### Development Mode

```bash
uvicorn app.main:app --reload
```

#### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Docker

```bash
docker build -t pptx-processor-service .
docker run -p 8000:8000 -v /tmp/pptx-processor:/tmp/pptx-processor pptx-processor-service
```

## Integration with PowerPoint Translator App

This microservice is designed to work with the PowerPoint Translator App frontend, which uses the processed SVGs and text data to render slides with interactive text overlays for translation.

The integration workflow:

1. Frontend uploads PPTX file to Supabase Storage
2. Frontend creates a translation session record in the database
3. Frontend calls this microservice's `/process` endpoint with the session ID and Supabase credentials
4. Microservice processes the PPTX, converts slides to SVGs, extracts text data
5. Microservice uploads SVGs and thumbnails to Supabase Storage
6. Microservice returns structured data that matches the SlideCanvas component's requirements

## Development

### Project Structure

```
pptx-processor-service/
├── app/
│   ├── api/
│   │   └── routes/        # API route handlers
│   ├── core/              # Core configuration and settings
│   ├── models/            # Pydantic models/schemas
│   ├── services/          # Business logic services
│   └── utils/             # Utility functions
├── docs/                  # Documentation
├── tests/                 # Test cases
├── .env.example           # Example environment variables
├── Dockerfile             # Docker configuration
├── requirements.txt       # Python dependencies
└── README.md              # This file
```

### Testing

```bash
pytest
```

## License

[MIT License](LICENSE) 