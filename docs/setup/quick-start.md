# Quick Start Guide

Get the PowerPoint Translator App running in 5 minutes with Docker.

## Prerequisites

- Docker and Docker Compose installed
- Git for cloning the repository
- A Supabase account (free tier works)

## 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd pptxTransed

# Copy environment template
cp .env.example .env
```

## 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your credentials from Settings > API
3. Update `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

## 3. Setup Database

1. Go to your Supabase dashboard
2. Open the SQL Editor
3. Run the database setup script from [Supabase Setup](./supabase-setup.md#initial-database-schema)

## 4. Start the Application

```bash
# Start all services with Docker
docker-compose up -d

# Check status
docker-compose ps
```

## 5. Access the Application

- **Frontend**: http://localhost:3000
- **API Health Checks**:
  - Audit Service: http://localhost:4006/health
  - PPTX Processor: http://localhost:8000/v1/health
  - Share Service: http://localhost:3001/health

## 6. Test the Setup

1. Open http://localhost:3000
2. Sign up for a new account
3. Upload a test PPTX file
4. Verify the processing pipeline works

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Rebuild if needed
docker-compose build --no-cache
docker-compose up -d
```

### Database connection issues
- Verify Supabase credentials in `.env`
- Check if database schema was created
- Ensure RLS policies are set up

### File processing fails
- Check PPTX Processor logs: `docker-compose logs pptx-processor`
- Verify LibreOffice is installed in the container
- Test with a simple PPTX file first

## Next Steps

- [Development Environment Setup](./development.md) for local development
- [Service Integration Guide](../integration/overview.md) for customization
- [Testing Guide](../testing/testing-guide.md) for running tests

## Need Help?

- Check the [full documentation](../README.md)
- Review service-specific logs with `docker-compose logs [service-name]`
- Verify environment variables are correctly set 