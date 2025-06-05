#!/bin/bash

# Script to start the share service for local testing

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
echo "           Share Service Launcher                      "
echo "======================================================"
echo -e "${NC}"

# Check if the share service directory exists
if [ ! -d "services/share-service" ]; then
  echo -e "${RED}Error: services/share-service directory not found!${NC}"
  exit 1
fi

# Check if .env file already exists
if [ ! -f "services/share-service/.env" ]; then
  # Create the .env file with required variables if it doesn't exist
  echo -e "${BLUE}Creating .env file with required variables...${NC}"

  # Create a .env file with required variables
  cat > services/share-service/.env << EOF
PORT=3003
LOG_LEVEL=debug
JWT_SECRET=local-development-secret-key
CORS_ORIGIN=http://localhost:3000
EOF

  # Check if Supabase values are already in the file
  if ! grep -q "SUPABASE_URL" services/share-service/.env; then
    # Supabase URL not found, add default values
    cat >> services/share-service/.env << EOF
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
EOF
    
    echo -e "${YELLOW}Please update services/share-service/.env with your actual Supabase credentials.${NC}"
    echo "Press Ctrl+C to exit or any key to continue..."
    read -n 1 -s
  fi
else
  echo -e "${GREEN}Using existing .env file in share-service directory.${NC}"
fi

# Navigate to the share service directory
cd services/share-service

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
  echo -e "${RED}Error: Bun is not installed or not in PATH!${NC}"
  echo "Please install Bun (https://bun.sh) to continue"
  exit 1
fi

# Run the service using the npm script
echo -e "${GREEN}Running share service on port 3003...${NC}"
bun run dev

# This script can be enhanced to include database setup, migrations, etc. 