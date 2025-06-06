# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PowerPoint Translator is a microservices-based web application for translating PowerPoint presentations while preserving formatting. The system consists of:

- **Frontend**: Next.js 14 with TypeScript, Zustand state management, 69 components
- **PPTX Processor**: Python/FastAPI service for slide processing (15/15 tests passing)
- **Audit Service**: Go/Gin service for activity logging (✅ Fixed - all tests passing)
- **Share Service**: TypeScript/Bun service for session sharing (✅ Verified functional)
- **Translation Session Service**: TypeScript/Bun service (✅ Complete with comprehensive test suite)

## Development Commands

### Frontend (Next.js)
```bash
# Development server
bun dev

# Build and test
bun run build
bun run lint

# Type checking (inferred - no explicit script)
bun tsc --noEmit
```

### PPTX Processor Service
```bash
cd services/pptx-processor

# Install dependencies
uv pip install -r requirements.txt

# Run tests (verified working - 15/15 pass)
python -m pytest
python -m pytest tests/ -v

# Start service
python app/main.py
# or with Docker
docker-compose up pptx-processor
```

### Audit Service (Go)
```bash
cd services/audit-service

# Install dependencies
go mod download

# Run tests (✅ All passing)
go test ./...
go test ./... -v

# Build and run
go build -o audit-service cmd/server/main.go
./audit-service

# With Docker
docker-compose up audit-service
```

### Share Service (TypeScript/Bun)
```bash
cd services/share-service

# Install dependencies
bun install

# Run service
bun run src/index.ts

# With Docker
docker-compose up share-service
```

### Translation Session Service (TypeScript/Bun)
```bash
cd services/translation-session-service

# Install dependencies
bun install

# Run tests (comprehensive test suite)
bun test
bun run test:unit
bun run test:integration
bun run test:e2e

# Run service
bun run start
bun run dev  # with watch mode

# With Docker
docker-compose up translation-session-service
```

### Docker Development (Recommended)
```bash
# Start all services
node scripts/docker-manager.js start

# View logs
node scripts/docker-manager.js logs

# Rebuild after changes
node scripts/docker-manager.js rebuild

# Stop all services
node scripts/docker-manager.js stop
```

## Always Use

- Use `bun` instead of `npm`
- Use `uv` instead of `pip`

## Architecture Overview

### Frontend Architecture
- **Framework**: Next.js 14 with App Router
- **State Management**: Zustand with sophisticated slice-based architecture:
  - `slices/session-slice.ts` - Session management
  - `slices/slides-slice.ts` - Slide editing
  - `slices/comments-slice.ts` - Commenting system
  - `slices/share-slice.ts` - Sharing functionality
  - `slices/offline-queue-slice.ts` - Offline capabilities
- **Real-time Sync**: Supabase real-time subscriptions with selective updates
- **Auth**: Supabase Auth with JWT tokens
- **Components**: 69 components in `/components` directory using shadcn/ui

### Service Communication
- **PPTX Processing**: Frontend → PPTX Processor → Supabase
- **Audit Logging**: All services → Audit Service → Supabase
- **Session Sharing**: Frontend → Share Service → Supabase
- **Real-time Updates**: Supabase → Frontend via WebSocket

### Database (Supabase)
- **Auth**: User authentication and session management
- **Storage**: PPTX files and generated SVGs
- **Real-time**: Live collaboration via PostgreSQL triggers
- **Types**: Generated types in `lib/database.types.ts`

## Current Status (Updated 2025-01-06)

### ✅ Working Services
1. **Frontend**: Fully functional with comprehensive state management
2. **PPTX Processor**: Verified working with all tests passing (15/15)
3. **Audit Service**: ✅ Fixed and functional with all tests passing
4. **Share Service**: ✅ Verified functional with working API endpoints
5. **Translation Session Service**: ✅ Complete with comprehensive test suite (85%+ coverage)
6. **Docker Setup**: Properly configured for development
7. **Documentation**: Comprehensive and up-to-date

### ⚠️ Needs Verification
1. **End-to-end testing**: Verify complete user workflows
2. **Data flow verification**: Test service-to-service communication
3. **Export functionality**: Verify with real translated content

## Environment Variables

Required environment variables (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `PPTX_PROCESSOR_URL` - PPTX service URL (default: http://localhost:8000)
- `AUDIT_SERVICE_URL` - Audit service URL (default: http://localhost:4006)
- `SHARE_SERVICE_URL` - Share service URL (default: http://localhost:4007)
- `TRANSLATION_SESSION_SERVICE_URL` - Translation session service URL (default: http://localhost:3002)

## Troubleshooting

### Service Status Verification
- **Audit Service**: All tests passing (fixed 2025-01-06)
- **Share Service**: Functional on port 4007 (verified 2025-01-06)
- **Translation Session Service**: Complete with comprehensive test suite on port 3002 (implemented 2025-01-06)
- **PPTX Processor**: 15/15 tests passing

### Common Issues
1. **Service Communication**: Ensure all services are running on correct ports
2. **Supabase Connection**: Verify environment variables and network access
3. **Docker Issues**: Use `node scripts/docker-manager.js logs` to debug

## Production Considerations

**Current Status**: All critical service issues resolved. The system is ready for integration testing and end-to-end verification before production deployment.