@echo off
setlocal enabledelayedexpansion

:: Script to start the PPTX processor service for local testing on Windows

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
echo          PPTX Processor Service Launcher              
echo ======================================================
echo !NC!

:: Check if the PPTX processor service directory exists
if not exist "services\pptx-processor" (
    echo !RED!Error: services\pptx-processor directory not found!!NC!
    exit /b 1
)

:: Check if .env file already exists
if not exist "services\pptx-processor\.env" (
    :: Create the .env file with required variables if it doesn't exist
    echo !BLUE!Creating .env file with required variables...!NC!
    (
    echo PORT=3001
    echo LOG_LEVEL=debug
    echo CORS_ORIGIN=http://localhost:3000
    echo UPLOADS_DIR=./uploads
    echo PROCESSING_DIR=./processing
    ) > services\pptx-processor\.env

    :: Check if Supabase values need to be added
    findstr /c:"SUPABASE_URL" services\pptx-processor\.env >nul
    if !ERRORLEVEL! neq 0 (
        echo SUPABASE_URL=https://your-project-id.supabase.co >> services\pptx-processor\.env
        echo SUPABASE_KEY=your-supabase-anon-key >> services\pptx-processor\.env
        
        echo !YELLOW!Please update services\pptx-processor\.env with your actual Supabase credentials.!NC!
        echo Press Ctrl+C to exit or any key to continue...
        pause >nul
    )
) else (
    echo !GREEN!Using existing .env file in pptx-processor directory.!NC!
)

:: Create necessary directories for uploads and processing
if not exist services\pptx-processor\uploads mkdir services\pptx-processor\uploads
if not exist services\pptx-processor\processing mkdir services\pptx-processor\processing

:: Navigate to the PPTX processor service directory
cd services\pptx-processor

:: Check if Python is installed
where python >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo !RED!Error: Python is not installed or not in PATH!!NC!
    echo Please install Python to continue
    exit /b 1
)

:: Check if required dependencies are installed
echo !BLUE!Checking dependencies...!NC!
where libreoffice >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo !YELLOW!Warning: LibreOffice is not installed or not in PATH!NC!
    echo Some features may not work correctly without LibreOffice
)

:: Check if uv is installed
where uv >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo !RED!Error: uv is not installed or not in PATH!!NC!
    echo Please install uv from: https://github.com/astral-sh/uv
    exit /b 1
)

:: Create and activate virtual environment with uv if it doesn't exist
if not exist .venv (
    echo !BLUE!Creating virtual environment with uv...!NC!
    uv venv .venv
)

:: Activate virtual environment
echo !BLUE!Activating virtual environment...!NC!
call .venv\Scripts\activate.bat

:: Install requirements if needed
if exist requirements.txt (
    echo !BLUE!Installing dependencies with uv...!NC!
    uv pip install -r requirements.txt
)

:: Run the service
echo !GREEN!Running PPTX processor service on port 3001...!NC!
uv python -m app.main

:: This script can be enhanced to include database setup, migrations, etc.
endlocal 