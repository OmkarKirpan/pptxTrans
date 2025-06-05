#!/bin/bash

# Script to start the audit service for local testing

echo "Starting Audit Service..."

# Check if the audit service directory exists
if [ ! -d "audit-service" ]; then
  echo "Error: audit-service directory not found!"
  exit 1
fi

# Check if .env file already exists
if [ ! -f "audit-service/.env" ]; then
  # Create the .env file with required variables if it doesn't exist
  echo "Creating .env file with required variables..."

  # Create a .env file with required variables
  cat > audit-service/.env << EOF
PORT=4006
LOG_LEVEL=debug
JWT_SECRET=local-development-secret-key
CORS_ORIGIN=http://localhost:3000
EOF

  # Check if Supabase values are already in the file
  if ! grep -q "SUPABASE_URL" audit-service/.env; then
    # Supabase URL not found, add default values
    cat >> audit-service/.env << EOF
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
EOF
    
    echo "Please update audit-service/.env with your actual Supabase credentials."
    echo "Press Ctrl+C to exit or any key to continue..."
    read -n 1 -s
  fi
else
  echo "Using existing .env file in audit-service directory."
fi

# Navigate to the audit service directory
cd audit-service

# Check if Go is installed
if ! command -v go &> /dev/null; then
  echo "Error: Go is not installed or not in PATH!"
  exit 1
fi

# Run the service using the Makefile's dev target
echo "Running audit service on port 4006..."
make dev

# This script can be enhanced to include database setup, migrations, etc. 