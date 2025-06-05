#!/bin/bash

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Function to show usage
function show_usage {
  echo -e "${BLUE}PPTX Translator Docker Manager${NC}"
  echo ""
  echo "Usage: $0 [command] [service]"
  echo ""
  echo "Commands:"
  echo "  up            Start services in development mode"
  echo "  up:prod       Start services in production mode"
  echo "  down          Stop and remove containers"
  echo "  restart       Restart services"
  echo "  logs          View logs"
  echo "  build         Build or rebuild services"
  echo "  status        Show status of services"
  echo "  prune         Remove all unused containers, networks, images"
  echo "  help          Show this help message"
  echo ""
  echo "Services (optional):"
  echo "  frontend       Next.js frontend"
  echo "  audit-service  Audit service (Go)"
  echo "  pptx-processor PPTX processor service (Python)"
  echo "  share-service  Share service (Bun)"
  echo ""
  echo "Examples:"
  echo "  $0 up              # Start all services in dev mode"
  echo "  $0 up:prod         # Start all services in production mode"
  echo "  $0 logs pptx-processor  # View logs for PPTX processor"
  echo "  $0 restart frontend     # Restart only the frontend"
}

# Function to check if .env file exists, create if it doesn't
function check_env_file {
  if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}No .env file found. Creating a sample one...${NC}"
    cat > "$PROJECT_ROOT/.env" << EOL
# Supabase Configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Application Settings
NODE_ENV=development
JWT_SECRET=local-development-secret-key
CORS_ORIGIN=http://localhost:3000

# For Production Only
# AUDIT_SERVICE_URL=https://audit-api.yourdomain.com
# PPTX_PROCESSOR_URL=https://pptx-api.yourdomain.com
# SHARE_SERVICE_URL=https://share-api.yourdomain.com
EOL
    echo -e "${GREEN}Created sample .env file at $PROJECT_ROOT/.env${NC}"
    echo -e "${YELLOW}Please update it with your actual configuration before continuing.${NC}"
    exit 1
  fi
}

# Ensure we're in the project root directory
cd "$PROJECT_ROOT"

# Parse command
COMMAND=$1
SERVICE=$2

# Check if a command was provided
if [ -z "$COMMAND" ] || [ "$COMMAND" = "help" ]; then
  show_usage
  exit 0
fi

# Ensure .env file exists
check_env_file

# Process commands
case "$COMMAND" in
  up)
    echo -e "${GREEN}Starting services in development mode...${NC}"
    if [ -z "$SERVICE" ]; then
      docker-compose up -d
    else
      docker-compose up -d "$SERVICE"
    fi
    echo -e "${GREEN}Services are now running.${NC}"
    echo -e "Access the application at: ${BLUE}http://localhost:3000${NC}"
    ;;
    
  up:prod)
    echo -e "${GREEN}Starting services in production mode...${NC}"
    if [ -z "$SERVICE" ]; then
      docker-compose -f docker-compose.prod.yml up -d
    else
      docker-compose -f docker-compose.prod.yml up -d "$SERVICE"
    fi
    echo -e "${GREEN}Production services are now running.${NC}"
    echo -e "Access the application at: ${BLUE}http://localhost:3000${NC}"
    ;;
    
  down)
    echo -e "${YELLOW}Stopping services...${NC}"
    if [ "$SERVICE" = "prod" ]; then
      docker-compose -f docker-compose.prod.yml down
    else
      docker-compose down
    fi
    echo -e "${GREEN}Services stopped.${NC}"
    ;;
    
  restart)
    echo -e "${YELLOW}Restarting services...${NC}"
    if [ -z "$SERVICE" ]; then
      docker-compose restart
    else
      docker-compose restart "$SERVICE"
    fi
    echo -e "${GREEN}Services restarted.${NC}"
    ;;
    
  logs)
    if [ -z "$SERVICE" ]; then
      echo -e "${YELLOW}Showing logs for all services...${NC}"
      docker-compose logs -f
    else
      echo -e "${YELLOW}Showing logs for $SERVICE...${NC}"
      docker-compose logs -f "$SERVICE"
    fi
    ;;
    
  build)
    echo -e "${YELLOW}Building services...${NC}"
    if [ -z "$SERVICE" ]; then
      docker-compose build
    else
      docker-compose build "$SERVICE"
    fi
    echo -e "${GREEN}Build complete.${NC}"
    ;;
    
  status)
    echo -e "${BLUE}Service Status:${NC}"
    docker-compose ps
    ;;
    
  prune)
    echo -e "${RED}WARNING: This will remove all unused containers, networks, and images.${NC}"
    read -p "Are you sure you want to continue? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Removing unused Docker resources...${NC}"
      docker system prune -a --volumes -f
      echo -e "${GREEN}Pruning complete.${NC}"
    fi
    ;;
    
  *)
    echo -e "${RED}Unknown command: $COMMAND${NC}"
    show_usage
    exit 1
    ;;
esac

exit 0 