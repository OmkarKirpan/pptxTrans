@echo off
setlocal enabledelayedexpansion

:: Script to start the share service for local testing on Windows

:: Color codes for Windows console
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "NC=[0m"

echo !MAGENTA!
echo ======================================================
echo            Share Service Launcher                      
echo ======================================================
echo !NC!

:: Check if the share service directory exists
if not exist "services\share-service" (
    echo !RED!Error: services\share-service directory not found!!NC!
    exit /b 1
)

:: Check if .env file already exists
if not exist "services\share-service\.env" (
    :: Create the .env file with required variables if it doesn't exist
    echo !BLUE!Creating .env file with required variables...!NC!
    (
    echo PORT=3003
    echo LOG_LEVEL=debug
    echo JWT_SECRET=local-development-secret-key
    echo CORS_ORIGIN=http://localhost:3000
    ) > services\share-service\.env

    :: Check if Supabase values need to be added
    findstr /c:"SUPABASE_URL" services\share-service\.env >nul
    if !ERRORLEVEL! neq 0 (
        echo SUPABASE_URL=https://your-project-id.supabase.co >> services\share-service\.env
        echo SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key >> services\share-service\.env
        echo SUPABASE_JWT_SECRET=your-supabase-jwt-secret >> services\share-service\.env
        
        echo !YELLOW!Please update services\share-service\.env with your actual Supabase credentials.!NC!
        echo Press Ctrl+C to exit or any key to continue...
        pause >nul
    )
) else (
    echo !GREEN!Using existing .env file in share-service directory.!NC!
)

:: Navigate to the share service directory
cd services\share-service

:: Check if Bun is installed
where bun >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo !RED!Error: Bun is not installed or not in PATH!!NC!
    echo Please install Bun (https://bun.sh) to continue
    exit /b 1
)

:: Run the service using the npm script
echo !GREEN!Running share service on port 3003...!NC!
bun run dev

:: This script can be enhanced to include database setup, migrations, etc.
endlocal 