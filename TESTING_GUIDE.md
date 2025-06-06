# PowerPoint Translator App - Testing Guide

This guide provides step-by-step instructions to get all services running for testing.

## Prerequisites

Before you start, ensure you have:
- **Docker** and **Docker Compose** installed
- **Node.js** (v18+) and **Bun** installed (for local development)
- **Git** for cloning and version control
- A **Supabase account** (free tier works fine)

## Quick Start (Docker - Recommended)

### Step 1: Set Up Environment Variables

1. **Create environment file from template:**
   ```bash
   node scripts/docker-manager.js env
   ```
   
   This will create a `.env` file from the `docker-compose.env.example` template.

2. **Get your Supabase credentials:**
   - Go to [https://supabase.com](https://supabase.com)
   - Create a new project (or use existing)
   - Go to **Settings** → **API** and copy:
     - Project URL
     - anon public key
     - service_role secret key
     - JWT Secret

3. **Update the `.env` file** with your actual Supabase credentials:
   ```bash
   # Edit the .env file
   nano .env  # or use your preferred editor
   
   # Update these values:
   SUPABASE_URL=https://your-actual-project-id.supabase.co
   SUPABASE_ANON_KEY=your-actual-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
   SUPABASE_JWT_SECRET=your-actual-jwt-secret
   ```

### Step 2: Start All Services

```bash
# Start all services with Docker Compose
node scripts/docker-manager.js start
```

This command will:
- Build all Docker images
- Start all services in detached mode
- Display service URLs

### Step 3: Verify Services Are Running

Check if all services are healthy:
```bash
# Check service status
node scripts/docker-manager.js ps

# View logs to ensure no errors
node scripts/docker-manager.js logs
```

### Step 4: Access the Application

Once all services are running, you can access:

- **Frontend**: http://localhost:3000
- **PPTX Processor**: http://localhost:8000 (API docs at `/docs`)
- **Audit Service**: http://localhost:4006 (health check at `/health`)
- **Share Service**: http://localhost:3001

### Step 5: Test Basic Functionality

1. **Open the frontend**: http://localhost:3000
2. **Sign up/Login** with a test account
3. **Upload a PowerPoint file** (.pptx)
4. **Check the processing** works correctly
5. **Verify audit logs** are being created

## Alternative: Local Development Setup

If you prefer to run services locally without Docker:

### Step 1: Set Up Environment Files

```bash
# Copy environment templates for each service
cp env.example .env.local
cp services/pptx-processor/env.example services/pptx-processor/.env
cp services/audit-service/env.example services/audit-service/.env
cp services/share-service/env.example services/share-service/.env
cp services/translation-session-service/env.example services/translation-session-service/.env
```

### Step 2: Update Environment Files

Update each `.env` file with your Supabase credentials.

### Step 3: Start Services Individually

**Frontend (Next.js):**
```bash
bun install
bun dev
```

**PPTX Processor (Python/FastAPI):**
```bash
cd services/pptx-processor
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Audit Service (Go):**
```bash
cd services/audit-service
go mod download
go run cmd/server/main.go
```

**Share Service (Bun/Hono.js):**
```bash
cd services/share-service
bun install
bun run src/index.ts
```

**Translation Session Service (Bun/Hono.js):**
```bash
cd services/translation-session-service
bun install
bun run src/index.ts
```

## Testing Scripts

The project includes several testing scripts:

### Integration Tests

```bash
# Test PPTX processor integration
node scripts/tests/test-pptx-integration.js

# Test audit service
node scripts/tests/test-audit-service.js
```

### Environment Validation

```bash
# Check audit service environment
node scripts/utils/check-audit-env.js
```

## Docker Manager Commands

The Docker manager script provides several useful commands:

```bash
# Start all services
node scripts/docker-manager.js start

# Stop all services
node scripts/docker-manager.js stop

# Restart all services
node scripts/docker-manager.js restart

# Rebuild all services (after code changes)
node scripts/docker-manager.js rebuild

# View logs for all services
node scripts/docker-manager.js logs

# View logs for specific service
node scripts/docker-manager.js logs frontend
node scripts/docker-manager.js logs pptx-processor
node scripts/docker-manager.js logs audit-service

# Open shell in a service container
node scripts/docker-manager.js shell frontend
node scripts/docker-manager.js shell pptx-processor

# Check running services
node scripts/docker-manager.js ps

# Set up environment variables
node scripts/docker-manager.js env

# Show help
node scripts/docker-manager.js help
```

## Troubleshooting

### Common Issues

1. **Services not starting:**
   ```bash
   # Check logs for errors
   node scripts/docker-manager.js logs
   
   # Rebuild services
   node scripts/docker-manager.js rebuild
   ```

2. **Environment variable errors:**
   ```bash
   # Recreate environment file
   rm .env
   node scripts/docker-manager.js env
   # Then update with your Supabase credentials
   ```

3. **Port conflicts:**
   - Ensure ports 3000, 3001, 4006, 8000 are available
   - Stop any existing services using these ports

4. **Docker issues:**
   ```bash
   # Clean up Docker resources
   docker system prune -a
   
   # Rebuild from scratch
   node scripts/docker-manager.js stop
   node scripts/docker-manager.js rebuild
   node scripts/docker-manager.js start
   ```

### Service-Specific Issues

**PPTX Processor:**
- Requires LibreOffice (included in Docker image)
- Check temp directory permissions
- Verify Supabase storage bucket exists

**Audit Service:**
- Requires Go runtime (Docker handles this)
- Check Supabase JWT secret is correct
- Verify database connection

**Frontend:**
- Ensure all service URLs are accessible
- Check Supabase configuration
- Verify authentication is working

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Edit .env file and set:
LOG_LEVEL=debug

# Restart services
node scripts/docker-manager.js restart
```

## Development Workflow

For active development:

1. **Start services in development mode:**
   ```bash
   node scripts/docker-manager.js start
   ```

2. **Make code changes**

3. **Rebuild affected services:**
   ```bash
   # Rebuild specific service
   docker-compose build pptx-processor
   docker-compose up -d pptx-processor
   
   # Or rebuild all
   node scripts/docker-manager.js rebuild
   ```

4. **Test changes:**
   ```bash
   # Run integration tests
   node scripts/tests/test-pptx-integration.js
   ```

5. **View logs for debugging:**
   ```bash
   node scripts/docker-manager.js logs pptx-processor
   ```

## Next Steps

Once you have the services running:

1. **Explore the API documentation:**
   - PPTX Processor: http://localhost:8000/docs
   - Check other service health endpoints

2. **Test file upload and processing**

3. **Verify user authentication flows**

4. **Test presentation sharing functionality**

5. **Check audit logging is working**

6. **Run the full integration test suite**

For detailed setup instructions, see [docs/setup/environment-setup.md](docs/setup/environment-setup.md).

## Need Help?

- Check the [environment setup guide](docs/setup/environment-setup.md)
- Review service-specific documentation in `docs/`
- Check logs with `node scripts/docker-manager.js logs`
- Verify your Supabase configuration is correct 