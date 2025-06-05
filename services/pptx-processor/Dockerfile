FROM python:3.12-slim

WORKDIR /app

# Install system dependencies including LibreOffice
RUN apt-get update && apt-get install -y \
    build-essential \
    libreoffice \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-draw \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager
RUN pip install --no-cache-dir uv

# Copy requirements first for better layer caching
COPY requirements.txt .
RUN uv pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create necessary directories
RUN mkdir -p /tmp/uploads /tmp/processing

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV LIBREOFFICE_PATH=/usr/bin/soffice
ENV TEMP_UPLOAD_DIR=/tmp/uploads
ENV TEMP_PROCESSING_DIR=/tmp/processing

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 