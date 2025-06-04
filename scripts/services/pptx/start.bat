@echo off
setlocal enabledelayedexpansion

:: Start the PPTX Processor Service
:: This script helps start the PPTX processor service for development purposes

:: Color codes for Windows console
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "NC=[0m"

:: Default variables
set PPTX_SERVICE_PORT=3001
set SUPABASE_URL=
set SUPABASE_KEY=

:: Load environment variables from .env.local if exists
if exist .env.local (
  echo !BLUE!Found .env.local file. Loading environment variables...!NC!
  for /f "tokens=*" %%a in ('type .env.local ^| findstr NEXT_PUBLIC_SUPABASE') do (
    set "%%a"
  )
)

:: Set variables from environment if available
if defined NEXT_PUBLIC_SUPABASE_URL set SUPABASE_URL=!NEXT_PUBLIC_SUPABASE_URL!
if defined NEXT_PUBLIC_SUPABASE_ANON_KEY set SUPABASE_KEY=!NEXT_PUBLIC_SUPABASE_ANON_KEY!

:: Print the banner
echo !MAGENTA!
echo ======================================================
echo          PPTX Processor Service Launcher              
echo ======================================================
echo !NC!

:: Check if Docker is installed
docker --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo !RED!Error: Docker is not installed or not in PATH!NC!
  echo Please install Docker to continue
  exit /b 1
)

:: Check if Docker is running
docker info > nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo !RED!Error: Docker is not running!NC!
  echo Please start Docker daemon to continue
  exit /b 1
)

:: Check for Supabase configuration
if "!SUPABASE_URL!"=="" (
  echo !YELLOW!Warning: Supabase URL is not set!NC!
  echo The PPTX processor service may not work correctly without Supabase credentials
)

if "!SUPABASE_KEY!"=="" (
  echo !YELLOW!Warning: Supabase key is not set!NC!
  echo The PPTX processor service may not work correctly without Supabase credentials
)

:: Create storage directories for the PPTX processor
if not exist .\tmp\pptx-uploads mkdir .\tmp\pptx-uploads
if not exist .\tmp\pptx-processing mkdir .\tmp\pptx-processing

echo !BLUE!Starting PPTX Processor service on port %PPTX_SERVICE_PORT%...!NC!

:: Pull the image if needed
echo !CYAN!Pulling latest PPTX processor image...!NC!
docker pull ghcr.io/pptx-translator/pptx-processor:latest

:: Stop any existing container
for /f "delims=" %%i in ('docker ps -q --filter "name=pptx-processor"') do (
  set EXISTING_CONTAINER=%%i
)

if defined EXISTING_CONTAINER (
  echo !YELLOW!Stopping existing PPTX processor container...!NC!
  docker stop !EXISTING_CONTAINER! > nul 2>&1
  docker rm !EXISTING_CONTAINER! > nul 2>&1
)

:: Start the container
echo !GREEN!Starting PPTX processor container...!NC!
docker run -d ^
    --name pptx-processor ^
    -p %PPTX_SERVICE_PORT%:3001 ^
    -v "%cd%\tmp\pptx-uploads:/app/uploads" ^
    -v "%cd%\tmp\pptx-processing:/app/processing" ^
    -e SUPABASE_URL="%SUPABASE_URL%" ^
    -e SUPABASE_KEY="%SUPABASE_KEY%" ^
    -e PORT=3001 ^
    ghcr.io/pptx-translator/pptx-processor:latest

:: Check if container started successfully
if %ERRORLEVEL% equ 0 (
    echo !GREEN!PPTX Processor service started successfully!!NC!
    echo !BLUE!Service is available at: http://localhost:%PPTX_SERVICE_PORT%!NC!
    echo.
    echo !CYAN!To check if the service is running:!NC!
    echo   curl http://localhost:%PPTX_SERVICE_PORT%/api/health
    echo.
    echo !CYAN!To view logs:!NC!
    echo   docker logs pptx-processor
    echo.
    echo !CYAN!To stop the service:!NC!
    echo   docker stop pptx-processor
    echo.
) else (
    echo !RED!Failed to start PPTX Processor service!NC!
    echo Check the Docker logs for more details
)

endlocal 