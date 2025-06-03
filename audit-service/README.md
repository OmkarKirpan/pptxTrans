# Audit Service

A Go-based microservice providing read-only access to audit logs for PowerPoint translation sessions.

## Features

- JWT authentication with Supabase
- Share token validation for reviewer access
- Token caching for performance (90%+ cache hit rate)
- Paginated audit log retrieval
- Structured logging with Zap
- Connection pooling for Supabase REST API
- Graceful shutdown
- Docker support
- Health check endpoint
- Event creation API for tracking user actions

## Architecture

The service follows Domain-Driven Design (DDD) principles with clear separation of concerns:

```
cmd/server/          # Application entry point
internal/
  config/           # Configuration management
  domain/           # Business entities and errors
  handlers/         # HTTP handlers
  middleware/       # HTTP middleware (auth, logging, etc.)
  repository/       # Data access layer
  service/          # Business logic
pkg/
  cache/           # Token caching
  jwt/             # JWT validation
  logger/          # Logging setup
```

## Prerequisites

- Go 1.21+
- Docker (optional)
- Access to Supabase instance with:
  - `audit_logs` table
  - `sessions` table
  - `session_shares` table

## Configuration

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for API access
- `SUPABASE_JWT_SECRET`: JWT secret for token validation
- `CORS_ORIGIN`: CORS allowed origin (default: http://localhost:3000)

## Local Development

### Install dependencies
```bash
go mod download
```

### Run locally
```bash
make run
```

### Run tests
```bash
make test
```

### Run with coverage
```bash
make test-coverage
```

### Run linter
```bash
make lint
```

## Docker

### Build image
```bash
make docker-build
```

### Run with Docker Compose
```bash
docker-compose up
```

## API Endpoints

### Health Check
```
GET /health
```

### Create Audit Event
```
POST /api/v1/events
```

Request body:
```json
{
  "sessionId": "uuid or test-session-id",
  "type": "edit",
  "details": {
    "slideId": "slide-1",
    "textId": "text-1",
    "before": "Hello",
    "after": "Hello World"
  }
}
```

Response:
```json
{
  "id": "event-id",
  "sessionId": "uuid or test-session-id",
  "userId": "user-id",
  "type": "edit",
  "timestamp": "2024-01-01T00:00:00Z",
  "success": true
}
```

### Get Audit History
```
GET /api/v1/sessions/{sessionId}/history
```

Query parameters:
- `limit`: Number of items to return (default: 50, max: 100)
- `offset`: Number of items to skip (default: 0)
- `share_token`: Optional share token for reviewer access

Headers:
- `Authorization: Bearer {jwt_token}` (required if no share_token)

Response:
```json
{
  "totalCount": 42,
  "items": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "userId": "uuid",
      "action": "edit",
      "timestamp": "2024-01-01T00:00:00Z",
      "details": {}
    }
  ]
}
```

## Testing with the Audit Test Page

The PowerPoint Translator application includes an audit test page at:
```
http://localhost:3000/audit-test
```

This page allows you to:
1. Test service connectivity (health check)
2. Create test audit events
3. View audit logs for test sessions
4. Test offline functionality with the event queue
5. Directly test the `/api/v1/events` endpoint without using the queue

To use the test page:
1. Ensure the audit service is running at http://localhost:4006
2. Navigate to http://localhost:3000/audit-test in your browser
3. Use the "Send Events" tab to create test events
   - Check "Test direct API call to /api/v1/events endpoint" to bypass the queue
   - Uncheck to use the normal event queue for offline resilience testing
4. View events in the "View Events" tab

## Error Responses

The service returns consistent error responses:

```json
{
  "error": "unauthorized",
  "message": "Invalid or missing authentication"
}
```

Common error codes:
- `401 unauthorized`: Missing or invalid authentication
- `403 forbidden`: Access denied to resource
- `404 not_found`: Session not found
- `400 bad_request`: Invalid request parameters
- `500 internal_error`: Server error
- `503 service_unavailable`: Service temporarily unavailable

## Performance

- Response time target: < 200ms (p95)
- Token cache TTL: 5 minutes (JWT), 1 minute (share tokens)
- HTTP connection pooling for Supabase API
- Structured logging with minimal overhead

## Monitoring

- Structured JSON logs with request IDs
- Health check endpoint for uptime monitoring
- Cache hit/miss statistics available in logs

## Development

### Project Structure
```
audit-service/
├── cmd/server/main.go       # Entry point
├── internal/                # Private packages
├── pkg/                     # Public packages
├── Makefile                # Build commands
├── Dockerfile              # Container definition
├── docker-compose.yml      # Local development
├── go.mod                  # Dependencies
└── README.md              # This file
```

### Adding New Features

1. Define domain models in `internal/domain`
2. Add repository methods in `internal/repository`
3. Implement business logic in `internal/service`
4. Create HTTP handlers in `internal/handlers`
5. Add routes in `cmd/server/main.go`
6. Write tests for each layer

## License

[Your License Here] 