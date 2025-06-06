#!/bin/bash

# Script to start the Share service for local testing

echo "🚀 Starting Share Service..."

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
  echo "❌ Error: share-service directory not found at $SHARE_SERVICE_DIR!"
  exit 1
fi

# Check if .env file already exists
if [ ! -f "$SHARE_SERVICE_DIR/.env" ]; then
  # Create the .env file with required variables if it doesn't exist
  echo "📝 Creating .env file with required variables..."

  # Create a .env file with required variables
  cat > "$SHARE_SERVICE_DIR/.env" << EOF
# Port Configuration
PORT=3001

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# Security Configuration
SHARE_TOKEN_SECRET=local-development-secret-key

# Environment
NODE_ENV=development
EOF
    
    echo "⚠️  Please update $SHARE_SERVICE_DIR/.env with your actual Supabase credentials."
    echo "📖 See docs/setup/environment-setup.md for detailed setup instructions."
    echo ""
    echo "Press Enter to continue with default values or Ctrl+C to exit and update credentials..."
    read -r
else
  echo "✅ Using existing .env file in share-service directory."
  
  # Check if SHARE_TOKEN_SECRET is missing and add it
  if ! grep -q "SHARE_TOKEN_SECRET" "$SHARE_SERVICE_DIR/.env"; then
    echo "🔧 Adding missing SHARE_TOKEN_SECRET to .env file..."
    echo "" >> "$SHARE_SERVICE_DIR/.env"
    echo "# Security Configuration" >> "$SHARE_SERVICE_DIR/.env"
    echo "SHARE_TOKEN_SECRET=local-development-secret-key" >> "$SHARE_SERVICE_DIR/.env"
    echo "✅ Added SHARE_TOKEN_SECRET to .env file"
  fi
fi

# Navigate to the share service directory
cd "$SHARE_SERVICE_DIR"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
  echo "❌ Error: Bun is not installed or not in PATH!"
  echo "📦 Please install Bun to continue: https://bun.sh/"
  echo "   curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

# Install dependencies if needed
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies with bun..."
  bun install
fi

# Check if dist directory exists (for production mode)
if [ ! -d "dist" ]; then
  echo "🔨 Building the service..."
  bun run build
fi

# Validate environment variables
echo "🔍 Validating environment variables..."
if ! grep -q "SUPABASE_URL=https://your-project-id.supabase.co" .env; then
  echo "✅ Supabase URL appears to be configured"
else
  echo "⚠️  Supabase URL is using default placeholder value"
fi

if ! grep -q "SHARE_TOKEN_SECRET=local-development-secret-key" .env; then
  echo "✅ Share token secret appears to be configured"
else
  echo "⚠️  Share token secret is using default value (OK for development)"
fi

# Run the service in development mode
echo "🌟 Running Share service on port 3001..."
echo "📍 Service will be available at: http://localhost:3001"
echo "🏥 Health check endpoint: http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

# Start the service
bun run dev

# This script can be enhanced to include database setup, migrations, etc. 