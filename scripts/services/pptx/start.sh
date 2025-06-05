#!/bin/bash

# Script to start the PPTX processor service for local testing

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}"
echo "======================================================"
echo "         PPTX Processor Service Launcher              "
echo "======================================================"
echo -e "${NC}"

# Find the project root (where package.json is located)
find_root() {
  local current_dir="$PWD"
  while [[ "$current_dir" != "/" ]]; do
    if [[ -f "$current_dir/package.json" ]]; then
      echo "$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done
  echo "$PWD"  # Fallback to current directory
}

# Get project root
PROJECT_ROOT=$(find_root)
PPTX_SERVICE_DIR="$PROJECT_ROOT/services/pptx-processor"

# Check if the PPTX processor service directory exists
if [ ! -d "$PPTX_SERVICE_DIR" ]; then
  echo -e "${RED}Error: services/pptx-processor directory not found at $PPTX_SERVICE_DIR!${NC}"
  exit 1
fi

# Check if .env file already exists
if [ ! -f "$PPTX_SERVICE_DIR/.env" ]; then
  # Create the .env file with required variables if it doesn't exist
  echo -e "${BLUE}Creating .env file with required variables...${NC}"

  # Create a .env file with required variables
  cat > "$PPTX_SERVICE_DIR/.env" << EOF
PORT=3001
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
UPLOADS_DIR=./uploads
PROCESSING_DIR=./processing
EOF

  # Check if Supabase values are already in the file
  if ! grep -q "SUPABASE_URL" "$PPTX_SERVICE_DIR/.env"; then
    # Supabase URL not found, add default values
    cat >> "$PPTX_SERVICE_DIR/.env" << EOF
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
EOF
    
    echo -e "${YELLOW}Please update $PPTX_SERVICE_DIR/.env with your actual Supabase credentials.${NC}"
    echo "Press Ctrl+C to exit or any key to continue..."
    read -n 1 -s
  fi
else
  echo -e "${GREEN}Using existing .env file in pptx-processor directory.${NC}"
fi

# Create necessary directories for uploads and processing
mkdir -p "$PPTX_SERVICE_DIR/uploads"
mkdir -p "$PPTX_SERVICE_DIR/processing"

# Navigate to the PPTX processor service directory
cd "$PPTX_SERVICE_DIR"

# Check if Python is installed
if ! command -v python &> /dev/null; then
  echo -e "${RED}Error: Python is not installed or not in PATH!${NC}"
  echo "Please install Python to continue"
  exit 1
fi

# Check if required dependencies are installed
echo -e "${BLUE}Checking dependencies...${NC}"
if ! command -v libreoffice &> /dev/null; then
  echo -e "${YELLOW}Warning: LibreOffice is not installed or not in PATH${NC}"
  echo "Some features may not work correctly without LibreOffice"
fi

# Check if uv is installed
if ! command -v uv &> /dev/null; then
  echo -e "${RED}Error: uv is not installed or not in PATH!${NC}"
  echo "Please install uv using: curl -sSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

# Create and activate virtual environment with uv if it doesn't exist
if [ ! -d ".venv" ]; then
  echo -e "${BLUE}Creating virtual environment with uv...${NC}"
  uv venv .venv
fi

# Activate virtual environment
echo -e "${BLUE}Activating virtual environment...${NC}"
source .venv/bin/activate

# Install requirements if needed
if [ -f "requirements.txt" ]; then
  echo -e "${BLUE}Installing dependencies with uv...${NC}"
  uv pip install -r requirements.txt
fi

# Run the service
echo -e "${GREEN}Running PPTX processor service on port 8000...${NC}"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# This script can be enhanced to include database setup, migrations, etc. 