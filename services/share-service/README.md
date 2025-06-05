# Share Service

A lightweight service for managing secure share links for the PowerPoint Translator application.

## Features

- Generate secure share links with configurable permissions
- JWT-based token system with validation
- Role-based access (viewer, commenter, reviewer)
- Token expiration management
- Integration with Supabase for storage

## Technology Stack

- **Runtime:** Bun.js
- **Framework:** Hono.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT tokens via jose
- **Validation:** Zod
- **Logging:** Pino

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/share` | POST | Generate a share link |
| `/api/share/validate` | GET | Validate a share token |
| `/api/share/list` | GET | List shares for a session |
| `/api/share/revoke` | DELETE | Revoke a share token |

## Development

### Prerequisites

- Bun.js installed
- Supabase account and project
- Environment variables set (see `.env.example`)

### Setup

1. Install dependencies:
   ```
   bun install
   ```

2. Create a `.env` file based on `.env.example` and fill in your credentials.

3. Start the development server:
   ```
   bun run dev
   ```

### Building for Production

```
bun run build
```

## Docker

Build the Docker image:

```
docker build -t share-service .
```

Run the container:

```
docker run -p 3001:3001 --env-file .env share-service
```

## Integration with Frontend

See the [share-service-integration.md](../../docs/share-service-integration.md) document for details on how to integrate this service with the frontend application. 