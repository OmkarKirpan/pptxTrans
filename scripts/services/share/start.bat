@echo off
REM Script to start the Share service for local testing on Windows

echo Starting Share Service...

REM Find the project root (where package.json is located)
call :find_root
set PROJECT_ROOT=%ERRORLEVEL%
set SHARE_SERVICE_DIR=%PROJECT_ROOT%\services\share-service

REM Check if the share service directory exists
if not exist "%SHARE_SERVICE_DIR%" (
    echo Error: share-service directory not found at %SHARE_SERVICE_DIR%!
    exit /b 1
)

REM Check if .env file already exists
if not exist "%SHARE_SERVICE_DIR%\.env" (
    REM Create the .env file with required variables if it doesn't exist
    echo Creating .env file with required variables...
    (
    echo PORT=3001
    echo CORS_ORIGIN=http://localhost:3000
    ) > "%SHARE_SERVICE_DIR%\.env"

    REM Check if Supabase values need to be added
    findstr /c:"SUPABASE_URL" "%SHARE_SERVICE_DIR%\.env" >nul
    if %ERRORLEVEL% neq 0 (
        echo SUPABASE_URL=https://your-project-id.supabase.co >> "%SHARE_SERVICE_DIR%\.env"
        echo SUPABASE_KEY=your-supabase-anon-key >> "%SHARE_SERVICE_DIR%\.env"
        echo SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key >> "%SHARE_SERVICE_DIR%\.env"
        
        echo Please update %SHARE_SERVICE_DIR%\.env with your actual Supabase credentials.
        echo Press Ctrl+C to exit or any key to continue...
        pause >nul
    )
) else (
    echo Using existing .env file in share-service directory.
)

REM Navigate to the share service directory
cd /d "%SHARE_SERVICE_DIR%"

REM Check if Bun is installed
where bun >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Bun is not installed or not in PATH!
    echo Please install Bun to continue: https://bun.sh/
    exit /b 1
)

REM Install dependencies if needed
if exist "package.json" if not exist "node_modules" (
    echo Installing dependencies with bun...
    bun install
)

REM Run the service
echo Running Share service on port 3001...
bun run dev

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