FROM python:3.12-slim AS builder

# Install build dependencies for packages that might need compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install uv using the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set UV environment variables for optimal Docker builds
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Create virtual environment
RUN uv venv /opt/venv

# Use the virtual environment
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install dependencies using uv with cache mounting
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

# Install LibreOffice and runtime dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    libreoffice-common \
    libreoffice-impress \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    # Create a non-root user to run the application
    && useradd -m -s /bin/bash appuser

# Copy the virtual environment from builder stage
COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv

# Set environment to use the virtual environment
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

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