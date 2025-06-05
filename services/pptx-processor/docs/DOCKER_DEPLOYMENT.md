# Docker Deployment Guide for PPTX Processor Service

This guide provides instructions for deploying the PPTX Processor Service using Docker in a production environment.

## Prerequisites

- Docker Engine (20.10.0+)
- Docker Compose (2.0.0+)
- Git

## System Requirements

- CPU: At least 2 cores (4+ recommended)
- RAM: At least 2GB (4GB+ recommended)
- Storage: At least 10GB available (20GB+ recommended for high volume processing)
- Network: Outbound internet access for Supabase integration

## Deployment Options

### Option 1: Standalone PPTX Processor Service

If you only need to deploy the PPTX Processor Service separately:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pptxtransed.git
   cd pptxtransed/services/pptx-processor
   ```

2. Create a `.env` file:
   ```bash
   cp env.example .env
   ```

3. Configure environment variables in `.env`:
   ```
   # API Configuration
   API_ENV=production
   API_PORT=8000
   API_HOST=0.0.0.0
   LOG_LEVEL=info
   
   # LibreOffice Configuration
   LIBREOFFICE_PATH=/usr/bin/soffice
   
   # Processing Configuration
   TEMP_UPLOAD_DIR=/tmp/uploads
   TEMP_PROCESSING_DIR=/tmp/processing
   
   # Supabase Configuration - REQUIRED
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   
   # CORS Configuration
   CORS_ORIGIN=https://yourdomain.com
   ```

4. Build and start the service:
   ```bash
   docker-compose up -d
   ```

5. Verify the service is running:
   ```bash
   curl http://localhost:8000/v1/health
   ```

### Option 2: Full Application Deployment

To deploy the entire application including the frontend and all services:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pptxtransed.git
   cd pptxtransed
   ```

2. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Configure environment variables in `.env` (see the full example below)

4. Use the docker-manager script to deploy in production mode:
   ```bash
   ./scripts/docker-manager.sh up:prod
   ```

5. Verify all services are running:
   ```bash
   ./scripts/docker-manager.sh status
   ```

## Environment Variables

### Essential Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | URL of your Supabase project | `https://abcdefghijklm.supabase.co` |
| `SUPABASE_KEY` | Anon/public key from Supabase | `eyJhbGciOiJIUzI1NiIsInR5...` |
| `CORS_ORIGIN` | Allowed origins for CORS | `https://yourdomain.com` |

### Advanced Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `API_ENV` | Environment (development/production) | `production` |
| `LOG_LEVEL` | Logging level | `info` |
| `LIBREOFFICE_PATH` | Path to LibreOffice binary | `/usr/bin/soffice` |

## Container Resource Management

For production deployments, it's recommended to set resource limits:

```yaml
services:
  pptx-processor:
    # ... other configuration ...
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

Adjust these values based on your workload requirements.

## Volume Management

The service requires two persistent volumes:

1. `pptx_uploads`: For temporary storage of uploaded PPTX files
2. `pptx_processing`: For temporary storage of processing results

These volumes are automatically created when using Docker Compose.

## Health Monitoring

The service exposes a health endpoint at `/v1/health` that returns HTTP 200 when healthy.

You can monitor the service health with:

```bash
curl http://localhost:8000/v1/health
```

For production deployments, consider setting up external health monitoring using tools like Prometheus, Grafana, or a cloud provider's monitoring service.

## Logging

The service outputs structured JSON logs to stdout/stderr. In production, you should configure a logging driver to collect and process these logs.

Example Docker Compose configuration with log driver:

```yaml
services:
  pptx-processor:
    # ... other configuration ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Security Considerations

1. **Network Security**: The service should ideally be placed behind a reverse proxy (Nginx, Traefik, etc.) with HTTPS enabled.
2. **Authentication**: Protect the API endpoints using API keys or JWT tokens.
3. **Rate Limiting**: Implement rate limiting at the proxy level to prevent abuse.
4. **File Validation**: The service validates file types, but additional security measures should be implemented at the application level.

## Troubleshooting

### Common Issues

1. **Service won't start**:
   - Check logs: `docker-compose logs pptx-processor`
   - Verify environment variables are set correctly
   - Ensure volumes have correct permissions

2. **Processing failures**:
   - Check if LibreOffice is installed correctly
   - Verify Supabase credentials are valid
   - Check if file upload directory has sufficient space

3. **Performance issues**:
   - Increase container resources (CPU/memory)
   - Consider scaling horizontally with multiple instances
   - Optimize LibreOffice configuration

### Diagnostic Commands

```bash
# Check container status
docker ps | grep pptx-processor

# View logs
docker-compose logs -f pptx-processor

# Access container shell
docker-compose exec pptx-processor /bin/bash

# Test LibreOffice availability
docker-compose exec pptx-processor /usr/bin/soffice --version
```

## Scaling Strategies

For high-volume deployments, consider:

1. **Horizontal Scaling**: Deploy multiple instances behind a load balancer
2. **Queue Management**: Implement a message queue (RabbitMQ, AWS SQS, etc.) for job distribution
3. **Caching**: Enable and optimize the built-in caching mechanism
4. **CDN Integration**: Use a CDN for serving the processed SVG files

## Backup and Recovery

1. **Database Backup**: Regularly backup your Supabase database
2. **Volume Backup**: Consider backing up the processing volumes if long-term storage is needed
3. **Disaster Recovery**: Document a recovery plan for service failure

## Monitoring and Alerts

Set up monitoring for:

1. **Service Health**: Regular health check endpoint polling
2. **Resource Usage**: CPU, memory, and disk space monitoring
3. **Processing Metrics**: Job throughput, success/failure rates, processing time
4. **Error Rates**: Monitor and alert on increased error rates

## Updates and Maintenance

1. **Rolling Updates**: Use Docker Compose's rolling update feature
2. **Zero-Downtime Updates**: Implement blue/green deployment strategy
3. **Version Control**: Always tag and version your Docker images

## Conclusion

This guide covers the essentials for deploying the PPTX Processor Service in a production environment. For specific requirements or advanced configurations, please contact the development team. 