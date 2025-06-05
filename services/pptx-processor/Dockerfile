FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager
RUN pip install --no-cache-dir uv

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install dependencies to a wheel directory
RUN uv pip install --no-cache-dir -r requirements.txt --wheel-dir /wheels

FROM python:3.12-slim

WORKDIR /app

# Install LibreOffice and runtime dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-draw \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    # Create a non-root user to run the application
    && useradd -m -s /bin/bash appuser

# Copy wheels from builder stage
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy the application code
COPY --chown=appuser:appuser . .

# Create necessary directories with proper permissions
RUN mkdir -p /tmp/uploads /tmp/processing \
    && chown -R appuser:appuser /tmp/uploads /tmp/processing \
    && chmod 755 /tmp/uploads /tmp/processing

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV LIBREOFFICE_PATH=/usr/bin/soffice
ENV TEMP_UPLOAD_DIR=/tmp/uploads
ENV TEMP_PROCESSING_DIR=/tmp/processing

# Expose the port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/v1/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 