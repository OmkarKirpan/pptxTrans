#!/bin/bash

# Script to start the Share service for local testing

echo "Starting Share Service..."

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
SHARE_SERVICE_DIR="$PROJECT_ROOT/services/share-service"

# Check if the share service directory exists
if [ ! -d "$SHARE_SERVICE_DIR" ]; then
  echo "Error: share-service directory not found at $SHARE_SERVICE_DIR!"
  exit 1
fi

# Check if .env file already exists
if [ ! -f "$SHARE_SERVICE_DIR/.env" ]; then
  # Create the .env file with required variables if it doesn't exist
  echo "Creating .env file with required variables..."

  # Create a .env file with required variables
  cat > "$SHARE_SERVICE_DIR/.env" << EOF
PORT=3001
CORS_ORIGIN=http://localhost:3000
EOF

  # Check if Supabase values are already in the file
  if ! grep -q "SUPABASE_URL" "$SHARE_SERVICE_DIR/.env"; then
    # Supabase URL not found, add default values
    cat >> "$SHARE_SERVICE_DIR/.env" << EOF
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
EOF
    
    echo "Please update $SHARE_SERVICE_DIR/.env with your actual Supabase credentials."
    echo "Press Ctrl+C to exit or any key to continue..."
    read -n 1 -s
  fi
else
  echo "Using existing .env file in share-service directory."
fi

# Navigate to the share service directory
cd "$SHARE_SERVICE_DIR"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
  echo "Error: Bun is not installed or not in PATH!"
  echo "Please install Bun to continue: https://bun.sh/"
  exit 1
fi

# Install dependencies if needed
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  echo "Installing dependencies with bun..."
  bun install
fi

# Run the service in development mode
echo "Running Share service on port 3001..."
bun run dev

# This script can be enhanced to include database setup, migrations, etc. 