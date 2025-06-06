# Docker Setup Guide - PowerPoint Translator App

This guide provides instructions for running the PowerPoint Translator App using Docker and Docker Compose.

## Prerequisites

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository
- **Environment Variables**: Supabase credentials (see Environment Setup below)

### System Requirements

- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: At least 5GB free space for images and volumes
- **CPU**: Multi-core processor recommended for optimal performance

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd pptxTransed
   ```

2. **Set up environment variables** (see Environment Setup section below)

3. **Start the application**:
   ```bash
   # Development environment
   docker-compose up -d

   # Production environment
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Audit Service: http://localhost:4006
   - PPTX Processor: http://localhost:8000
   - Share Service: http://localhost:3001

## Environment Setup

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Database Configuration (if using direct connection)
POSTGRES_URL=your-postgres-connection-string
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_HOST=your-host
POSTGRES_DATABASE=postgres

# Security
JWT_SECRET=your-jwt-secret-for-local-dev

# Production only (for docker-compose.prod.yml)
CORS_ORIGIN=https://yourdomain.com
AUDIT_SERVICE_URL=https://your-audit-service-url
PPTX_PROCESSOR_URL=https://your-pptx-processor-url
SHARE_SERVICE_URL=https://your-share-service-url
```

### Obtaining Supabase Credentials

1. Create a project at [supabase.com](https://supabase.com)
2. Navigate to Settings > API
3. Copy the following values:
   - **URL**: Your project URL
   - **anon public**: Public API key
   - **service_role**: Service role key (keep secure)
4. Navigate to Settings > API > JWT Settings
5. Copy the **JWT Secret**

## Supabase Database Setup

### Initial Database Schema

After creating your Supabase project, you need to set up the database schema. Go to the SQL Editor in your Supabase dashboard and run the following SQL scripts:

#### 1. Enable Required Extensions

```sql
-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';
```

#### 2. Create Core Tables

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translation sessions table
CREATE TABLE public.sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    source_language TEXT NOT NULL DEFAULT 'en',
    target_language TEXT NOT NULL DEFAULT 'es',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'translating', 'completed', 'archived')),
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_url TEXT,
    slide_count INTEGER DEFAULT 0,
    progress JSONB DEFAULT '{"completed": 0, "total": 0}',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slides table
CREATE TABLE public.slides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    slide_number INTEGER NOT NULL,
    title TEXT,
    svg_data TEXT,
    svg_url TEXT,
    original_elements JSONB DEFAULT '[]',
    translated_elements JSONB DEFAULT '[]',
    layout_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'translated', 'reviewed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, slide_number)
);

-- Text elements table
CREATE TABLE public.text_elements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    slide_id UUID REFERENCES public.slides(id) ON DELETE CASCADE,
    element_id TEXT NOT NULL,
    original_text TEXT NOT NULL,
    translated_text TEXT,
    position JSONB NOT NULL, -- {x, y, width, height}
    styling JSONB DEFAULT '{}', -- font, size, color, etc.
    translation_status TEXT DEFAULT 'pending' CHECK (translation_status IN ('pending', 'translating', 'translated', 'reviewed', 'approved')),
    confidence_score DECIMAL(3,2),
    translation_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(slide_id, element_id)
);

-- Comments and collaboration table
CREATE TABLE public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    slide_id UUID REFERENCES public.slides(id) ON DELETE CASCADE,
    element_id UUID REFERENCES public.text_elements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'comment' CHECK (type IN ('comment', 'suggestion', 'approval', 'rejection')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sharing and collaboration
CREATE TABLE public.session_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    shared_with_email TEXT,
    share_token TEXT UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{"read": true, "comment": false, "edit": false}',
    expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'session', 'slide', 'element', 'comment'
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File storage metadata
CREATE TABLE public.file_metadata (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL, -- 'original', 'processed', 'export'
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    checksum TEXT,
    storage_provider TEXT DEFAULT 'supabase',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. Create Indexes for Performance

```sql
-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);

-- Slides indexes
CREATE INDEX idx_slides_session_id ON public.slides(session_id);
CREATE INDEX idx_slides_status ON public.slides(status);
CREATE INDEX idx_slides_slide_number ON public.slides(session_id, slide_number);

-- Text elements indexes
CREATE INDEX idx_text_elements_slide_id ON public.text_elements(slide_id);
CREATE INDEX idx_text_elements_status ON public.text_elements(translation_status);

-- Comments indexes
CREATE INDEX idx_comments_session_id ON public.comments(session_id);
CREATE INDEX idx_comments_slide_id ON public.comments(slide_id);
CREATE INDEX idx_comments_element_id ON public.comments(element_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

-- Session shares indexes
CREATE INDEX idx_session_shares_token ON public.session_shares(share_token);
CREATE INDEX idx_session_shares_session_id ON public.session_shares(session_id);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_session_id ON public.audit_logs(session_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- File metadata indexes
CREATE INDEX idx_file_metadata_session_id ON public.file_metadata(session_id);
CREATE INDEX idx_file_metadata_file_type ON public.file_metadata(file_type);
```

#### 4. Set Up Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_metadata ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Sessions policies
CREATE POLICY "Users can view their own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON public.sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Shared sessions access
CREATE POLICY "Users can view shared sessions" ON public.sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.session_shares 
            WHERE session_id = sessions.id 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- Slides policies
CREATE POLICY "Users can view slides from their sessions" ON public.slides
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE id = slides.session_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can modify slides from their sessions" ON public.slides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE id = slides.session_id 
            AND user_id = auth.uid()
        )
    );

-- Text elements policies
CREATE POLICY "Users can view text elements from their sessions" ON public.text_elements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.slides s
            JOIN public.sessions sess ON s.session_id = sess.id
            WHERE s.id = text_elements.slide_id 
            AND sess.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can modify text elements from their sessions" ON public.text_elements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.slides s
            JOIN public.sessions sess ON s.session_id = sess.id
            WHERE s.id = text_elements.slide_id 
            AND sess.user_id = auth.uid()
        )
    );

-- Comments policies
CREATE POLICY "Users can view comments on their sessions" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE id = comments.session_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Session shares policies
CREATE POLICY "Users can manage shares for their sessions" ON public.session_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE id = session_shares.session_id 
            AND user_id = auth.uid()
        )
    );

-- Audit logs policies (read-only for users)
CREATE POLICY "Users can view audit logs for their sessions" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE id = audit_logs.session_id 
            AND user_id = auth.uid()
        )
    );

-- File metadata policies
CREATE POLICY "Users can view file metadata for their sessions" ON public.file_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE id = file_metadata.session_id 
            AND user_id = auth.uid()
        )
    );
```

#### 5. Create Database Functions

```sql
-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_sessions
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_slides
    BEFORE UPDATE ON public.slides
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_text_elements
    BEFORE UPDATE ON public.text_elements
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_comments
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_session_shares
    BEFORE UPDATE ON public.session_shares
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate secure share tokens
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired shares
CREATE OR REPLACE FUNCTION public.cleanup_expired_shares()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.session_shares 
    SET status = 'expired'
    WHERE expires_at < NOW() 
    AND status = 'active';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
```

#### 6. Set Up Storage Buckets

```sql
-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('session-files', 'session-files', false),
    ('processed-slides', 'processed-slides', false),
    ('exports', 'exports', false);

-- Set up storage policies
CREATE POLICY "Users can upload to their session folders" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'session-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their session files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'session-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their session files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'session-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their session files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'session-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Similar policies for processed-slides and exports buckets
CREATE POLICY "Users can access processed slides" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'processed-slides'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can access exports" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'exports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
```

#### 7. Insert Sample Data (Optional)

```sql
-- Insert sample subscription tiers reference data
INSERT INTO public.profiles (id, email, full_name, subscription_tier) 
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'demo@example.com', 'Demo User', 'free')
ON CONFLICT (id) DO NOTHING;

-- You can add more sample data as needed for testing
```

### Database Migration Script

You can also create a single migration script by combining all the above SQL commands. Save this as `supabase_setup.sql`:

```bash
# Run the complete setup
psql -h your-db-host -U postgres -d postgres -f supabase_setup.sql
```

### Verification Queries

After running the setup, verify everything is working:

```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Check storage buckets
SELECT * FROM storage.buckets;

-- Test user profile creation (after a user signs up)
SELECT * FROM public.profiles LIMIT 5;
```

## Architecture Overview

The application consists of 4 main services:

### 1. Frontend (Next.js)
- **Port**: 3000
- **Technology**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Function**: Main web application interface

### 2. Audit Service (Go)
- **Port**: 4006
- **Technology**: Go with Gin framework
- **Function**: Session tracking, user activity monitoring, and audit logging

### 3. PPTX Processor (Python)
- **Port**: 8000
- **Technology**: Python with FastAPI, LibreOffice integration
- **Function**: PPTX file processing, SVG conversion, text extraction

### 4. Share Service (Bun)
- **Port**: 3001
- **Technology**: Bun runtime with TypeScript
- **Function**: Session sharing, collaboration features

## Development Environment

### Starting Services

```bash
# Start all services
docker-compose up

# Start in detached mode (background)
docker-compose up -d

# Start specific service
docker-compose up frontend

# View logs
docker-compose logs -f [service-name]
```

### Development Features

- **Hot Reload**: The frontend supports hot reload for development
- **Volume Mounts**: Persistent storage for PPTX uploads and processing
- **Health Checks**: All services include health check endpoints
- **Networking**: Services communicate via Docker network

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

## Production Environment

### Starting Production Services

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Production Features

- **Resource Limits**: CPU and memory limits configured
- **Optimized Builds**: Production-optimized Docker builds
- **Health Monitoring**: Enhanced health checks for all services
- **Security**: Production-ready security configurations

### Production Environment Variables

Additional variables for production:

```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

## Service Management

### Individual Service Commands

```bash
# Restart a specific service
docker-compose restart [service-name]

# Rebuild a service
docker-compose build [service-name]

# Scale a service (if needed)
docker-compose up -d --scale [service-name]=2

# Execute commands in running container
docker-compose exec [service-name] /bin/bash
```

### Health Check Status

```bash
# Check all container health
docker-compose ps

# Check specific service health
curl http://localhost:3000/api/health  # Frontend
curl http://localhost:4006/health      # Audit Service
curl http://localhost:8000/v1/health   # PPTX Processor
curl http://localhost:3001/health      # Share Service
```

## Volumes and Data Persistence

### Persistent Volumes

- **pptx_uploads**: Stores uploaded PPTX files
- **pptx_processing**: Temporary processing files

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect pptxtransed_pptx_uploads

# Backup volume
docker run --rm -v pptxtransed_pptx_uploads:/data -v $(pwd):/backup busybox tar -czf /backup/uploads-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v pptxtransed_pptx_uploads:/data -v $(pwd):/backup busybox tar -xzf /backup/uploads-backup.tar.gz -C /data
```

## Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3000

# Change ports in docker-compose.yml if needed
```

#### 2. Memory Issues
```bash
# Check Docker memory usage
docker stats

# Increase Docker memory allocation in Docker Desktop
```

#### 3. Build Failures
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### 4. Service Dependencies
```bash
# Check service startup order
docker-compose logs [service-name]

# Services start in dependency order automatically
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific service
docker-compose logs -f frontend

# View last 50 lines
docker-compose logs --tail=50 [service-name]
```

### Container Shell Access

```bash
# Access frontend container
docker-compose exec frontend /bin/bash

# Access audit service container
docker-compose exec audit-service /bin/sh

# Access PPTX processor container
docker-compose exec pptx-processor /bin/bash

# Access share service container
docker-compose exec share-service /bin/bash
```

## Performance Optimization

### Development Tips

1. **Use Docker BuildKit**: Enable for faster builds
   ```bash
   export DOCKER_BUILDKIT=1
   ```

2. **Optimize .dockerignore**: Exclude unnecessary files from build context

3. **Use Multi-stage Builds**: Already implemented in Dockerfile

4. **Layer Caching**: Order Dockerfile commands from least to most frequently changing

### Production Tips

1. **Resource Monitoring**: Use `docker stats` to monitor resource usage

2. **Log Management**: Configure log rotation to prevent disk space issues

3. **Health Checks**: Monitor service health endpoints

4. **Backup Strategy**: Regular backups of persistent volumes

## Security Considerations

### Development
- Use strong JWT secrets
- Keep environment files secure
- Don't commit real credentials to version control

### Production
- Use HTTPS (configure reverse proxy)
- Set proper CORS origins
- Use production-grade secrets management
- Regular security updates for base images
- Network isolation
- Resource limits to prevent abuse

## Monitoring and Maintenance

### Health Monitoring
```bash
# Quick health check script
for port in 3000 4006 8000 3001; do
  echo "Checking port $port..."
  curl -f http://localhost:$port/health || echo "Service on port $port is down"
done
```

### Regular Maintenance
```bash
# Update base images
docker-compose pull

# Clean up unused resources
docker system prune -f

# Update application
git pull
docker-compose build
docker-compose up -d
```

## Support and Documentation

- **Frontend Documentation**: Check `/docs` directory
- **API Documentation**: Available at service health endpoints
- **Service-specific docs**: See `services/*/docs` directories
- **Issue Tracking**: Use repository issue tracker

For additional help, check the service-specific documentation in the `services/` directory or contact the development team. 