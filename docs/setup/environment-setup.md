# Environment Setup Guide

This guide covers setting up environment variables for the PowerPoint Translator App across all services.

## Quick Start

1. **Copy environment templates:**
   ```bash
   # Main frontend application
   cp env.example .env.local
   
   # Docker Compose (if using Docker)
   cp docker-compose.env.example .env
   
   # Individual services (if running separately)
   cp services/pptx-processor/env.example services/pptx-processor/.env
   cp services/audit-service/env.example services/audit-service/.env
   cp services/share-service/env.example services/share-service/.env
   cp services/translation-session-service/env.example services/translation-session-service/.env
   ```

2. **Set up Supabase project** (see [Supabase Setup](#supabase-setup))

3. **Fill in your Supabase credentials** in the copied environment files

## Environment Files Overview

| File | Purpose | Used By |
|------|---------|---------|
| `env.example` | Main frontend app configuration | Next.js application |
| `docker-compose.env.example` | Docker Compose deployment | All services via Docker |
| `services/pptx-processor/env.example` | PPTX processing service | Python/FastAPI service |
| `services/audit-service/env.example` | Activity logging service | Go/Gin service |
| `services/share-service/env.example` | Presentation sharing | Hono.js/Bun service |
| `services/translation-session-service/env.example` | Session management | Hono.js/Bun service |

## Supabase Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project initialization (2-3 minutes)

### 2. Get API Credentials

From your Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Get JWT Secret

1. Go to **Settings** → **API**
2. Copy **JWT Secret** → `SUPABASE_JWT_SECRET`

### 4. Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Optionally enable **Google**, **GitHub**, etc.

### 5. Set up Storage

1. Go to **Storage**
2. Create a bucket named `slide-visuals`
3. Set bucket to **Public** if you want direct access to processed slides

## Development Deployment Options

### Option 1: Docker Compose (Recommended)

1. Copy Docker environment file:
   ```bash
   cp docker-compose.env.example .env
   ```

2. Fill in your Supabase credentials in `.env`

3. Start all services:
   ```bash
   docker-compose up --build
   ```

4. Access the application at `http://localhost:3000`

### Option 2: Local Development

1. Copy main environment file:
   ```bash
   cp env.example .env.local
   ```

2. Fill in your Supabase credentials

3. Start the frontend:
   ```bash
   bun install
   bun dev
   ```

4. Start individual services as needed (see service-specific setup)

### Option 3: Hybrid (Frontend local, Services in Docker)

1. Set up both environment files:
   ```bash
   cp env.example .env.local
   cp docker-compose.env.example .env
   ```

2. Start only backend services with Docker:
   ```bash
   docker-compose up audit-service pptx-processor share-service
   ```

3. Start frontend locally:
   ```bash
   bun dev
   ```

## Service-Specific Configuration

### PPTX Processor Service

**Key configurations:**
- `LIBREOFFICE_PATH`: Auto-detected in Docker, may need manual setting locally
- `MAX_CONCURRENT_JOBS`: Adjust based on server capacity (default: 3)
- `TEMP_UPLOAD_DIR` & `TEMP_PROCESSING_DIR`: Ensure write permissions

**Local setup:**
```bash
cd services/pptx-processor
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Audit Service

**Key configurations:**
- `CACHE_JWT_TTL`: JWT validation cache duration
- `MAX_PAGE_SIZE`: API pagination limits
- `HTTP_TIMEOUT`: External service call timeouts

**Local setup:**
```bash
cd services/audit-service
go mod download
go run cmd/server/main.go
```

### Share Service

**Key configurations:**
- `JWT_SECRET_KEY`: For share token generation
- `APP_BASE_URL`: Used in share URL construction
- `SHARE_TOKEN_SECRET`: Additional security for share tokens

**Local setup:**
```bash
cd services/share-service
bun install
bun run src/index.ts
```

### Translation Session Service

**Key configurations:**
- `PORT`: Service port (default: 3002)
- `FRONTEND_URL`: For CORS configuration

**Local setup:**
```bash
cd services/translation-session-service
bun install
bun run src/index.ts
```

## Environment Variable Reference

### Common Variables (All Services)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anonymous key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJhbGciOi...` |
| `NODE_ENV` | Environment mode | `development` / `production` |

### Frontend Specific

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_PPTX_PROCESSOR_URL` | PPTX service URL | `http://localhost:8000` |
| `NEXT_PUBLIC_AUDIT_SERVICE_URL` | Audit service URL | `http://localhost:4006` |
| `NEXT_PUBLIC_SHARE_SERVICE_URL` | Share service URL | `http://localhost:3001` |
| `NEXT_PUBLIC_TRANSLATION_SESSION_SERVICE_URL` | Session service URL | `http://localhost:3002` |

### Security Best Practices

1. **Never commit actual environment files** to version control
2. **Use different keys for production** vs development
3. **Rotate JWT secrets** regularly in production
4. **Limit CORS origins** to known domains in production
5. **Use HTTPS URLs** for all production Supabase endpoints

## Troubleshooting

### Common Issues

1. **"Failed to connect to Supabase"**
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Check network connectivity
   - Ensure Supabase project is active

2. **"JWT validation failed"**
   - Verify `SUPABASE_JWT_SECRET` matches your project
   - Check token expiration
   - Ensure user is authenticated

3. **"Service connection refused"**
   - Verify service URLs in environment files
   - Check if services are running
   - For Docker: ensure services are on same network

4. **"Permission denied" errors**
   - Check Supabase RLS policies
   - Verify `SUPABASE_SERVICE_ROLE_KEY` for admin operations
   - Ensure proper file permissions for temp directories

### Debug Mode

Enable debug logging in all services:

```bash
# In environment files
LOG_LEVEL=debug

# Or via environment variable
export LOG_LEVEL=debug
```

## Production Considerations

1. **Use environment-specific URLs** (no localhost)
2. **Configure proper CORS origins**
3. **Set up SSL/TLS certificates**
4. **Use production Supabase tiers**
5. **Implement proper logging and monitoring**
6. **Set resource limits** for concurrent processing
7. **Configure backup strategies** for uploaded files 