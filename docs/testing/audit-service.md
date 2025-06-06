# Audit Service Testing Guide

This guide provides instructions on how to test the integration between the PowerPoint Translator App and the Audit Service.

## Prerequisites

- Go (1.18+) installed for running the Audit Service
- Node.js (18+) for running the PowerPoint Translator App
- Git
- A modern web browser

## Setup

### 1. Setting Environment Variables

Create a `.env.local` file in the root of the project with the following content:

```
NEXT_PUBLIC_AUDIT_SERVICE_URL=http://localhost:4006
```

### 2. Supabase Configuration

The startup scripts will automatically create or update an `.env` file in the `audit-service` directory with the required configuration structure. However, you will need to update the Supabase credentials with your actual values:

1. When you run the startup script for the first time, it will create a `.env` file with placeholder values
2. The script will pause and prompt you to update these values
3. Open `audit-service/.env` in your text editor
4. Update the following values with your actual Supabase credentials:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
   SUPABASE_JWT_SECRET=your-supabase-jwt-secret
   ```
5. Save the file and continue with the startup script

### 3. Starting the Audit Service

#### On Windows:

```bash
# From the project root
.\scripts\start-audit-service.bat
```

#### On Linux/macOS:

```bash
# From the project root
chmod +x scripts/start-audit-service.sh
./scripts/start-audit-service.sh
```

The audit service should start and listen on port 4006.

### 4. Starting the PowerPoint Translator App

In a separate terminal:

```bash
# From the project root
npm run dev
```

The app should start and be accessible at http://localhost:3000.

## Testing Procedures

### 1. Connectivity Testing

1. Open http://localhost:3000/audit-test in your browser
2. Log in if prompted
3. Navigate to the "Service Health" tab
4. Click "Check Health" to verify connectivity with the audit service

### 2. Manual Event Testing

1. Still on the audit test page, navigate to the "Send Events" tab
2. Enter a test session ID (e.g., "test-session-123")
3. Select different action types and send test events
4. Navigate to the "View Events" tab to see the events you've created

### 3. Application Flow Testing

Test the audit logging throughout the normal application flow:

1. Log in to the application
2. Create a new translation session (upload a PPTX file)
3. Configure the session (name, languages)
4. Edit text in the editor
5. Navigate to the audit log page from the editor using the "Audit Log" button
6. Verify that all your actions have been properly logged

### 4. Offline Testing

To test the offline queue functionality:

1. Stop the audit service (`Ctrl+C` in the terminal running the service)
2. Perform some actions in the application
3. Restart the audit service
4. Verify that the queued events are sent and appear in the logs

## Troubleshooting

### Common Issues

1. **Service Not Starting**
   - Check if port 4006 is already in use
   - Verify Go is installed and in your PATH
   - Check for error messages in the terminal
   - Ensure Supabase credentials in `audit-service/.env` are correct

2. **Events Not Appearing**
   - Verify JWT authentication is working
   - Check CORS settings
   - Look for error messages in browser console
   - Verify Supabase connection is working

3. **Connection Refused**
   - Make sure the audit service is running
   - Check the URL in the environment variables

4. **Missing Configuration**
   - If you see "Failed to load configuration" errors, check that the values in `audit-service/.env` are correct
   - Run the startup script again to recreate the .env file if needed

## Adding More Audit Points

To add audit logging to additional components:

1. Import the hook:
   ```typescript
   import { useAuditLog } from '@/hooks/useAuditLog';
   ```

2. Initialize with session ID:
   ```typescript
   const { createAuditEvent } = useAuditLog(sessionId);
   ```

3. Log events:
   ```typescript
   createAuditEvent('action_type', { details });
   ```

Where `action_type` is one of: 'create', 'edit', 'merge', 'reorder', 'comment', 'export', 'share', 'unshare', 'view'. 