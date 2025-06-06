# Supabase Setup Guide for PowerPoint Translator App

This document provides a comprehensive guide for setting up Supabase for the PowerPoint Translator application. This app uses Supabase for authentication, database, and storage services across multiple components.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating a Supabase Project](#creating-a-supabase-project)
- [Database Schema Setup](#database-schema-setup)
- [Authentication Configuration](#authentication-configuration)
- [Storage Buckets](#storage-buckets)
- [Environment Variables](#environment-variables)
- [Service-Specific Configurations](#service-specific-configurations)
  - [Main Next.js App](#main-nextjs-app)
  - [PPTX Processor Service](#pptx-processor-service)
  - [Audit Service](#audit-service)
  - [Share Service](#share-service)
- [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
- [Generating TypeScript Types](#generating-typescript-types)

## Prerequisites

- A [Supabase](https://supabase.com) account
- Node.js and npm/bun installed
- Basic understanding of SQL

## Creating a Supabase Project

1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Click **New Project**
3. Enter a project name (e.g., `pptx-translator`)
4. Choose a database password (store it securely)
5. Select a region closest to your users
6. Click **Create Project**

Once your project is created, you'll need these key values from the **Settings** > **API** page:
- Project URL
- API Keys (anon/public key and service role key)
- JWT Secret

## Database Schema Setup

The application requires several tables to function properly. You can execute the following SQL in the Supabase SQL Editor:

```sql
-- Translation sessions table
CREATE TABLE IF NOT EXISTS translation_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  slide_count INTEGER DEFAULT 0,
  source_language TEXT,
  target_language TEXT,
  thumbnail_url TEXT,
  original_file_path TEXT,
  translated_file_path TEXT
);

-- Slides table
CREATE TABLE IF NOT EXISTS slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT REFERENCES translation_sessions(id) NOT NULL,
  slide_number INTEGER NOT NULL,
  svg_url TEXT,
  original_width INTEGER,
  original_height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slide shapes table
CREATE TABLE IF NOT EXISTS slide_shapes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_id UUID REFERENCES slides(id) NOT NULL,
  shape_ppt_id TEXT,
  type TEXT NOT NULL,
  original_text TEXT,
  translated_text TEXT,
  x_coordinate FLOAT NOT NULL,
  y_coordinate FLOAT NOT NULL,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  coordinates_unit TEXT DEFAULT 'px',
  font_family TEXT,
  font_size FLOAT,
  is_bold BOOLEAN DEFAULT false,
  is_italic BOOLEAN DEFAULT false,
  text_color TEXT,
  text_align TEXT,
  vertical_align TEXT,
  background_color TEXT,
  reading_order INTEGER,
  has_comments BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session shares table
CREATE TABLE IF NOT EXISTS session_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT REFERENCES translation_sessions(id) NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('reviewer', 'viewer', 'commenter')),
  permissions JSONB NOT NULL DEFAULT '{"read": true, "comment": false, "edit": false}',
  email TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column_generic()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update the updated_at column
CREATE TRIGGER update_translation_sessions_updated_at
BEFORE UPDATE ON translation_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_generic();

CREATE TRIGGER update_slides_updated_at
BEFORE UPDATE ON slides
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_generic();

CREATE TRIGGER update_slide_shapes_updated_at
BEFORE UPDATE ON slide_shapes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_generic();

CREATE TRIGGER update_session_shares_updated_at
BEFORE UPDATE ON session_shares
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_generic();
```

## Authentication Configuration

1. In the Supabase dashboard, go to **Authentication** > **Providers**
2. Enable Email provider (default)
3. Optional: Configure additional providers as needed (Google, GitHub, etc.)
4. Configure email templates under **Authentication** > **Email Templates**
5. Set up URL Configuration under **Authentication** > **URL Configuration**:
   - Site URL: Your production URL (e.g., `https://yourdomain.com`)
   - Redirect URLs: Add all valid redirect URLs including development URLs
     - `http://localhost:3000/auth/callback`
     - `https://yourdomain.com/auth/callback`

## Storage Buckets

Create the following storage buckets in the Supabase dashboard under **Storage**:

1. `slides`: For storing slide SVG images
   - Click **New Bucket**
   - Name: `slides`
   - Make it public (for easy access to slide images)
   - Click **Create**

2. `presentations`: For storing original and translated PPTX files
   - Click **New Bucket**
   - Name: `presentations`
   - Recommended: Keep private (access via authenticated APIs)
   - Click **Create**

3. `thumbnails`: For slide thumbnails
   - Click **New Bucket**
   - Name: `thumbnails`
   - Make it public (for easy access to thumbnails)
   - Click **Create**

## Environment Variables

Set up the following environment variables in your project:

```env
# Supabase connection
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# PostgreSQL direct connection (if needed)
POSTGRES_URL=postgres://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
POSTGRES_USER=postgres
POSTGRES_HOST=db.your-project-ref.supabase.co
POSTGRES_PASSWORD=your-db-password
POSTGRES_DATABASE=postgres
POSTGRES_URL_NON_POOLING=postgres://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require
```

## Service-Specific Configurations

### Main Next.js App

The main application uses the Supabase JavaScript client with SSR support:

1. Install required packages:
   ```bash
   bun add @supabase/ssr @supabase/supabase-js
   ```

2. Configure client and server helpers in `/lib/supabase/`:
   - `client.ts` for browser-side operations
   - `server.ts` for server-side operations including admin access

3. Set up Next.js authentication callbacks in `/app/auth/` directory

### PPTX Processor Service

The PPTX processor service uses the Python Supabase client:

1. Install the Python Supabase client:
   ```bash
   pip install supabase
   ```

2. Configure environment variables for the service:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_KEY=your-service-role-key
   ```

3. The service handles:
   - Uploading slide SVGs to the `slides` bucket
   - Saving slide data and shapes to the database
   - Updating session status

### Audit Service

The Audit service uses a custom Go client to interact with Supabase:

1. Configure environment variables:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_KEY=your-service-role-key
   SUPABASE_JWT_SECRET=your-jwt-secret
   ```

2. The Go client implementation handles:
   - Authentication token validation
   - REST API calls to Supabase tables
   - Error handling and logging

### Share Service

The Share service uses the TypeScript Supabase client:

1. Install required packages:
   ```bash
   bun add @supabase/supabase-js
   ```

2. Configure environment variables:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

3. The service handles:
   - Creating and validating share tokens
   - Managing permissions for shared sessions
   - Retrieving shared session data

## Row Level Security (RLS) Policies

For production, enable Row Level Security and add appropriate policies:

```sql
-- Enable RLS on tables
ALTER TABLE translation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_shares ENABLE ROW LEVEL SECURITY;

-- Policies for translation_sessions
CREATE POLICY "Users can view their own sessions" 
ON translation_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" 
ON translation_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
ON translation_sessions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
ON translation_sessions FOR DELETE 
USING (auth.uid() = user_id);

-- Policies for slides (based on session ownership)
CREATE POLICY "Users can view slides of their sessions" 
ON slides FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM translation_sessions 
  WHERE translation_sessions.id = slides.session_id 
  AND translation_sessions.user_id = auth.uid()
));

-- Add similar policies for slide_shapes and session_shares
```

## Generating TypeScript Types

Generate TypeScript types from your Supabase database schema:

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Generate types:
   ```bash
   supabase gen types typescript --project-id your-project-ref > lib/database.types.ts
   ```

4. Update types whenever your schema changes

This completes the Supabase setup for the PowerPoint Translator application. Make sure to keep your environment variables secure and never commit them to version control. 