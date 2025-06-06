@echo off
REM Script to start the audit service for local testing on Windows

echo Starting Audit Service...

REM Find the project root (where package.json is located)
call :find_root
set PROJECT_ROOT=%ERRORLEVEL%
set AUDIT_SERVICE_DIR=%PROJECT_ROOT%\services\audit-service

REM Check if the audit service directory exists
if not exist "%AUDIT_SERVICE_DIR%" (
    echo Error: audit-service directory not found at %AUDIT_SERVICE_DIR%!
    exit /b 1
)

REM Check if .env file already exists
if not exist "%AUDIT_SERVICE_DIR%\.env" (
    REM Create the .env file with required variables if it doesn't exist
    echo Creating .env file with required variables...
    (
    echo PORT=4006
    echo LOG_LEVEL=debug
    echo JWT_SECRET=local-development-secret-key
    echo CORS_ORIGIN=http://localhost:3000
    ) > "%AUDIT_SERVICE_DIR%\.env"

    REM Check if Supabase values need to be added
    findstr /c:"SUPABASE_URL" "%AUDIT_SERVICE_DIR%\.env" >nul
    if %ERRORLEVEL% neq 0 (
        echo SUPABASE_URL=https://your-project-id.supabase.co >> "%AUDIT_SERVICE_DIR%\.env"
        echo SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key >> "%AUDIT_SERVICE_DIR%\.env"
        echo SUPABASE_JWT_SECRET=your-supabase-jwt-secret >> "%AUDIT_SERVICE_DIR%\.env"
        
        echo Please update %AUDIT_SERVICE_DIR%\.env with your actual Supabase credentials.
        echo Press Ctrl+C to exit or any key to continue...
        pause >nul
    )
) else (
    echo Using existing .env file in audit-service directory.
)

REM Navigate to the audit service directory
cd /d "%AUDIT_SERVICE_DIR%"

REM Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Go is not installed or not in PATH!
    exit /b 1
)

REM Run the service using the Makefile's dev target
echo Running audit service on port 4006...
make dev

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

REM This script can be enhanced to include database setup, migrations, etc. 