# Development Environment Setup

This guide covers setting up a local development environment for the PowerPoint Translator App without Docker.

## Prerequisites

- **Node.js**: Version 18+ (recommend using nvm)
- **Bun**: Latest version (package manager and runtime)
- **Python**: Version 3.9+ (for PPTX Processor)
- **Go**: Version 1.19+ (for Audit Service)
- **LibreOffice**: For PPTX processing
- **PostgreSQL**: Version 14+ (or use Supabase)

## Environment Setup

### 1. Install Dependencies

#### Node.js and Bun
```bash
# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install Bun
curl -fsSL https://bun.sh/install | bash
```

#### Python Dependencies
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies for PPTX Processor
cd services/pptx-processor
pip install -r requirements.txt
cd ../..
```

#### Go Dependencies
```bash
# Install Go dependencies for Audit Service
cd services/audit-service
go mod download
cd ../..
```

#### LibreOffice (for PPTX processing)
```bash
# Ubuntu/Debian
sudo apt-get install libreoffice

# macOS
brew install --cask libreoffice

# Windows
# Download from https://www.libreoffice.org/download/download/
```

### 2. Environment Variables

Create `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Service URLs (local development)
NEXT_PUBLIC_AUDIT_SERVICE_URL=http://localhost:4006
NEXT_PUBLIC_PPTX_PROCESSOR_URL=http://localhost:8000
NEXT_PUBLIC_SHARE_SERVICE_URL=http://localhost:3001

# Development settings
NODE_ENV=development
LOG_LEVEL=debug
```

### 3. Database Setup

Follow the [Supabase Setup Guide](./supabase-setup.md) to:
1. Create a Supabase project
2. Run the database schema setup
3. Configure authentication and storage

## Running Services Locally

### 1. Frontend (Next.js)

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Available at http://localhost:3000
```

### 2. PPTX Processor Service

```bash
cd services/pptx-processor

# Activate virtual environment
source venv/bin/activate

# Set environment variables
export API_ENV=development
export API_PORT=8000
export SUPABASE_URL=your-supabase-url
export SUPABASE_KEY=your-anon-key

# Start the service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Available at http://localhost:8000
```

### 3. Audit Service

```bash
cd services/audit-service

# Set environment variables
export PORT=4006
export LOG_LEVEL=debug
export SUPABASE_URL=your-supabase-url
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the service
go run cmd/server/main.go

# Available at http://localhost:4006
```

### 4. Share Service

```bash
cd services/share-service

# Install dependencies
bun install

# Set environment variables
export PORT=3001
export NODE_ENV=development
export SUPABASE_URL=your-supabase-url
export SUPABASE_KEY=your-anon-key

# Start the service
bun run dev

# Available at http://localhost:3001
```

## Development Workflow

### 1. Start All Services

Create a script `start-dev.sh`:

```bash
#!/bin/bash

# Start services in background
cd services/pptx-processor && source venv/bin/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
cd services/audit-service && go run cmd/server/main.go &
cd services/share-service && bun run dev &

# Start frontend
bun dev
```

### 2. Hot Reload Setup

- **Frontend**: Automatic with Next.js dev server
- **PPTX Processor**: Use `--reload` flag with uvicorn
- **Audit Service**: Use `air` for Go hot reload:
  ```bash
  go install github.com/cosmtrek/air@latest
  cd services/audit-service && air
  ```
- **Share Service**: Automatic with Bun

### 3. Database Migrations

```bash
# Generate types from Supabase
bunx supabase gen types typescript --project-id your-project-id > types/database.ts

# Run migrations (if using local Supabase)
bunx supabase db reset
```

## Development Tools

### 1. Code Quality

```bash
# Install development dependencies
bun add -d eslint prettier typescript @types/node

# Run linting
bun run lint

# Format code
bun run format
```

### 2. Testing

```bash
# Run frontend tests
bun test

# Run service tests
cd services/pptx-processor && python -m pytest
cd services/audit-service && go test ./...
cd services/share-service && bun test
```

### 3. Debugging

#### Frontend Debugging
- Use Next.js built-in debugger
- Browser DevTools
- VS Code debugger configuration

#### Service Debugging
- **Python**: Use `pdb` or VS Code Python debugger
- **Go**: Use `delve` debugger
- **Bun**: Use built-in debugger

## IDE Configuration

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "go.toolsManagement.checkForUpdates": "local",
  "python.defaultInterpreterPath": "./services/pptx-processor/venv/bin/python"
}
```

### Recommended Extensions

- TypeScript and JavaScript
- Go
- Python
- Prettier
- ESLint
- Tailwind CSS IntelliSense

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using a port
lsof -i :3000
lsof -i :8000
lsof -i :4006
lsof -i :3001

# Kill processes if needed
kill -9 <PID>
```

#### Python Virtual Environment
```bash
# Recreate if corrupted
rm -rf services/pptx-processor/venv
cd services/pptx-processor
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Go Module Issues
```bash
cd services/audit-service
go mod tidy
go mod download
```

#### LibreOffice Issues
```bash
# Test LibreOffice installation
libreoffice --headless --convert-to pdf test.pptx

# Check if it's in PATH
which libreoffice
```

### Performance Tips

1. **Use SSD**: Store project on SSD for faster file operations
2. **Increase Memory**: Allocate more RAM to Node.js if needed
3. **Use Fast Terminal**: Use a fast terminal emulator
4. **Optimize Docker**: If using Docker for some services, optimize container resources

## Next Steps

- [Service Integration Guide](../integration/overview.md)
- [Testing Guide](../testing/testing-guide.md)
- [API Documentation](../api/overview.md) 