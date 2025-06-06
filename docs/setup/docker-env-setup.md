# Docker Environment Setup Guide

This guide explains how to use .env files with Docker in the PPTXTransed project.

## Overview

The project supports two methods for managing environment variables in Docker:

1. **Standard Method**: Environment variables passed via docker-compose.yml (default)
2. **ENV File Method**: Individual .env files for each service (alternative)

## Quick Setup

To set up .env files for all services:

```bash
# Create/update .env files for root and all services
node scripts/docker-manager.js env
```

This command will:
- Create the root `.env` file from `docker-compose.env.example`
- Create `.env` files for each service from their `env.example` templates
- Synchronize common variables (Supabase credentials, JWT secrets) across all files

## Method 1: Standard Docker Compose (Default)

Uses environment variables defined in `docker-compose.yml`:

```bash
# Start with standard method
docker-compose up -d
```

**Pros:**
- Single source of truth (root .env file)
- Centralized configuration
- No file copying in containers

**Cons:**
- Service-specific variables must be defined in docker-compose.yml
- Less flexible for service-specific overrides

## Method 2: Service .env Files

Uses individual .env files for each service:

```bash
# Start with .env files method
docker-compose -f docker-compose.yml -f docker-compose.env.yml up -d
```

**Pros:**
- Service-specific configuration
- .env files are copied into containers
- Easier to manage complex service configurations
- Supports service-specific overrides

**Cons:**
- Multiple .env files to maintain
- Potential configuration drift

## Service .env File Locations

Each service has its own .env file:

```
services/
├── audit-service/.env              # Go service environment
├── pptx-processor/.env            # Python service environment  
├── share-service/.env             # Bun service environment
└── translation-session-service/.env # Bun service environment
```

## Environment Variable Synchronization

The `env` command automatically synchronizes these common variables across all services:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `JWT_SECRET`

## Docker Integration

### Dockerfile Changes

All service Dockerfiles have been updated to copy .env files:

```dockerfile
# Copy .env file if it exists (for Docker environment)
COPY --from=builder /app/.env* ./
```

### Docker Compose Override

The `docker-compose.env.yml` file provides service-specific env_file configuration:

```yaml
services:
  audit-service:
    env_file:
      - ./services/audit-service/.env
```

## Usage Examples

### Development Setup

```bash
# 1. Set up all environment files
node scripts/docker-manager.js env

# 2. Start with standard method
docker-compose up -d

# OR start with .env files method
docker-compose -f docker-compose.yml -f docker-compose.env.yml up -d
```

### Production Deployment

For production, use the .env files method for better security and service isolation:

```bash
# 1. Set up environment files
node scripts/docker-manager.js env

# 2. Update .env files with production values
# Edit services/*/env files as needed

# 3. Deploy with .env files
docker-compose -f docker-compose.yml -f docker-compose.env.yml up -d
```

### Service-Specific Configuration

To customize a specific service:

```bash
# 1. Edit the service's .env file
vim services/pptx-processor/.env

# 2. Rebuild and restart the service
docker-compose -f docker-compose.yml -f docker-compose.env.yml up -d --build pptx-processor
```

## Troubleshooting

### .env Files Not Found

If you get errors about missing .env files:

```bash
# Recreate all .env files
node scripts/docker-manager.js env
```

### Environment Variable Conflicts

If services aren't picking up the right environment variables:

1. Check if the .env file exists in the service directory
2. Verify the .env file has the correct variables
3. Rebuild the Docker container:

```bash
docker-compose build <service-name>
```

### Checking Environment Variables in Container

To verify environment variables are loaded correctly:

```bash
# Open shell in container
docker-compose exec <service-name> sh

# Check environment variables
env | grep SUPABASE
```

## Security Considerations

- **.env files contain sensitive data** - ensure they're in `.gitignore`
- **Use different secrets for production** - don't use development defaults
- **Rotate secrets regularly** - especially JWT secrets and API keys
- **Limit container access** - services run as non-root users

## Best Practices

1. **Always run `env` command after pulling updates** to ensure all services have .env files
2. **Use .env files method for production** for better security isolation
3. **Keep service .env files minimal** - only include necessary overrides
4. **Document service-specific variables** in the service's env.example file
5. **Test both methods** during development to ensure compatibility 