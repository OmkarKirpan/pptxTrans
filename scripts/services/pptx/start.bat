@echo off
REM Script to start the PPTX processor service for local testing on Windows

echo ======================================================
echo          PPTX Processor Service Launcher              
echo ======================================================

REM Find the project root (where package.json is located)
call :find_root
set PROJECT_ROOT=%ERRORLEVEL%
set PPTX_SERVICE_DIR=%PROJECT_ROOT%\services\pptx-processor

REM Check if the PPTX processor service directory exists
if not exist "%PPTX_SERVICE_DIR%" (
    echo Error: pptx-processor directory not found at %PPTX_SERVICE_DIR%!
    exit /b 1
)

REM Check if .env file already exists
if not exist "%PPTX_SERVICE_DIR%\.env" (
    REM Create the .env file with required variables if it doesn't exist
    echo Creating .env file with required variables...
    (
    echo PORT=3001
    echo LOG_LEVEL=debug
    echo CORS_ORIGIN=http://localhost:3000
    echo UPLOADS_DIR=./uploads
    echo PROCESSING_DIR=./processing
    ) > "%PPTX_SERVICE_DIR%\.env"

    REM Check if Supabase values need to be added
    findstr /c:"SUPABASE_URL" "%PPTX_SERVICE_DIR%\.env" >nul
    if %ERRORLEVEL% neq 0 (
        echo SUPABASE_URL=https://your-project-id.supabase.co >> "%PPTX_SERVICE_DIR%\.env"
        echo SUPABASE_KEY=your-supabase-anon-key >> "%PPTX_SERVICE_DIR%\.env"
        
        echo Please update %PPTX_SERVICE_DIR%\.env with your actual Supabase credentials.
        echo Press Ctrl+C to exit or any key to continue...
        pause >nul
    )
) else (
    echo Using existing .env file in pptx-processor directory.
)

REM Create necessary directories for uploads and processing
if not exist "%PPTX_SERVICE_DIR%\uploads" mkdir "%PPTX_SERVICE_DIR%\uploads"
if not exist "%PPTX_SERVICE_DIR%\processing" mkdir "%PPTX_SERVICE_DIR%\processing"

REM Navigate to the PPTX processor service directory
cd /d "%PPTX_SERVICE_DIR%"

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Python is not installed or not in PATH!
    echo Please install Python to continue
    exit /b 1
)

REM Check if required dependencies are installed
echo Checking dependencies...
where libreoffice >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Warning: LibreOffice is not installed or not in PATH
    echo Some features may not work correctly without LibreOffice
)

REM Check if uv is installed
where uv >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: uv is not installed or not in PATH!
    echo Please install uv using: curl -sSf https://astral.sh/uv/install.sh ^| sh
    exit /b 1
)

REM Create and activate virtual environment with uv if it doesn't exist
if not exist ".venv" (
    echo Creating virtual environment with uv...
    uv venv .venv
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat

REM Install requirements if needed
if exist "requirements.txt" (
    echo Installing dependencies with uv...
    uv pip install -r requirements.txt
)

REM Run the service
echo Running PPTX processor service on port 8000...
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

exit /b 0

REM Function to find the project root
:find_root
setlocal enabledelayedexpansion
set current_dir=%CD%
set found=0

REM Try to find package.json in current or parent directories
:find_root_loop
if exist "%current_dir%\package.json" (
    set found=1
    goto :found_root
)

REM Go up one directory
for %%I in ("%current_dir%\.") do set "parent_dir=%%~dpI"
set "parent_dir=%parent_dir:~0,-1%"

REM Check if we've reached the root
if "%parent_dir%" == "%current_dir%" goto :found_root

set "current_dir=%parent_dir%"
goto :find_root_loop

:found_root
if "%found%" == "1" (
    endlocal & exit /b %current_dir%
) else (
    REM Fallback to current directory if not found
    endlocal & exit /b %CD%
) 