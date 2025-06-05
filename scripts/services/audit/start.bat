@echo off
REM Script to start the audit service for local testing on Windows

echo Starting Audit Service...

REM Check if the audit service directory exists
if not exist "audit-service" (
    echo Error: audit-service directory not found!
    exit /b 1
)

REM Check if .env file already exists
if not exist "audit-service\.env" (
    REM Create the .env file with required variables if it doesn't exist
    echo Creating .env file with required variables...
    (
    echo PORT=4006
    echo LOG_LEVEL=debug
    echo JWT_SECRET=local-development-secret-key
    echo CORS_ORIGIN=http://localhost:3000
    ) > audit-service\.env

    REM Check if Supabase values need to be added
    findstr /c:"SUPABASE_URL" audit-service\.env >nul
    if %ERRORLEVEL% neq 0 (
        echo SUPABASE_URL=https://your-project-id.supabase.co >> audit-service\.env
        echo SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key >> audit-service\.env
        echo SUPABASE_JWT_SECRET=your-supabase-jwt-secret >> audit-service\.env
        
        echo Please update audit-service\.env with your actual Supabase credentials.
        echo Press Ctrl+C to exit or any key to continue...
        pause >nul
    )
) else (
    echo Using existing .env file in audit-service directory.
)

REM Navigate to the audit service directory
cd audit-service

REM Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Go is not installed or not in PATH!
    exit /b 1
)

REM Run the service using the Makefile's dev target
echo Running audit service on port 4006...
make dev

REM This script can be enhanced to include database setup, migrations, etc. 