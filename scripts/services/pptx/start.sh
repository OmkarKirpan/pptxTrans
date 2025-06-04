#!/bin/bash

# Start the PPTX Processor Service
# This script helps start the PPTX processor service for development purposes

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default variables
PPTX_SERVICE_PORT=${PPTX_SERVICE_PORT:-3001}
SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-""}
SUPABASE_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-""}

# Print the banner
echo -e "${MAGENTA}"
echo "======================================================"
echo "         PPTX Processor Service Launcher              "
echo "======================================================"
echo -e "${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    echo "Please install Docker to continue"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker daemon to continue"
    exit 1
fi

# Check for Supabase configuration
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${YELLOW}Warning: Supabase configuration is incomplete${NC}"
    echo "The PPTX processor service may not work correctly without Supabase credentials"
    
    # Try to load from .env.local
    if [ -f .env.local ]; then
        echo -e "${BLUE}Found .env.local file. Attempting to load Supabase configuration...${NC}"
        # Export variables from .env.local
        export $(grep -v '^#' .env.local | grep NEXT_PUBLIC_SUPABASE | xargs)
        SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-""}
        SUPABASE_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-""}
        
        if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
            echo -e "${GREEN}Successfully loaded Supabase configuration from .env.local${NC}"
        else
            echo -e "${YELLOW}Could not find Supabase configuration in .env.local${NC}"
        fi
    fi
fi

# Create storage directories for the PPTX processor
mkdir -p ./tmp/pptx-uploads
mkdir -p ./tmp/pptx-processing

echo -e "${BLUE}Starting PPTX Processor service on port $PPTX_SERVICE_PORT...${NC}"

# Pull the image if needed
echo -e "${CYAN}Pulling latest PPTX processor image...${NC}"
docker pull ghcr.io/pptx-translator/pptx-processor:latest

# Stop any existing container
EXISTING_CONTAINER=$(docker ps -q --filter "name=pptx-processor")
if [ -n "$EXISTING_CONTAINER" ]; then
    echo -e "${YELLOW}Stopping existing PPTX processor container...${NC}"
    docker stop $EXISTING_CONTAINER > /dev/null
    docker rm $EXISTING_CONTAINER > /dev/null
fi

# Start the container
echo -e "${GREEN}Starting PPTX processor container...${NC}"
docker run -d \
    --name pptx-processor \
    -p $PPTX_SERVICE_PORT:3001 \
    -v "$(pwd)/tmp/pptx-uploads:/app/uploads" \
    -v "$(pwd)/tmp/pptx-processing:/app/processing" \
    -e SUPABASE_URL="$SUPABASE_URL" \
    -e SUPABASE_KEY="$SUPABASE_KEY" \
    -e PORT=3001 \
    ghcr.io/pptx-translator/pptx-processor:latest

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PPTX Processor service started successfully!${NC}"
    echo -e "${BLUE}Service is available at: http://localhost:$PPTX_SERVICE_PORT${NC}"
    echo ""
    echo -e "${CYAN}To check if the service is running:${NC}"
    echo "  curl http://localhost:$PPTX_SERVICE_PORT/api/health"
    echo ""
    echo -e "${CYAN}To view logs:${NC}"
    echo "  docker logs pptx-processor"
    echo ""
    echo -e "${CYAN}To stop the service:${NC}"
    echo "  docker stop pptx-processor"
    echo ""
else
    echo -e "${RED}Failed to start PPTX Processor service${NC}"
    echo "Check the Docker logs for more details"
fi 