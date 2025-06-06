@echo off
REM Docker Manager Script for Windows
setlocal enabledelayedexpansion

REM Define colors for console output
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "NC=[0m"

REM Get the command from arguments
set "COMMAND=%~1"

REM If no command is provided, show help
if "%COMMAND%"=="" set "COMMAND=help"

REM Change to the project root directory
call :find_root
set PROJECT_ROOT=%ERRORLEVEL%
cd /d "%PROJECT_ROOT%"

REM Process the command
if "%COMMAND%"=="start" (
    echo %GREEN%Starting all services with Docker Compose...%NC%
    call :setup_env
    docker compose up -d
    if !ERRORLEVEL! neq 0 exit /b !ERRORLEVEL!
    
    echo %GREEN%Services started successfully!%NC%
    echo %YELLOW%Frontend: http://localhost:3000%NC%
    echo %YELLOW%Audit Service: http://localhost:4006%NC%
    echo %YELLOW%PPTX Processor: http://localhost:8000%NC%
    echo %YELLOW%Share Service: http://localhost:3001%NC%
    
) else if "%COMMAND%"=="stop" (
    echo %YELLOW%Stopping all services...%NC%
    docker compose down
    if !ERRORLEVEL! neq 0 exit /b !ERRORLEVEL!
    echo %GREEN%Services stopped successfully!%NC%
    
) else if "%COMMAND%"=="restart" (
    echo %YELLOW%Restarting all services...%NC%
    docker compose restart
    if !ERRORLEVEL! neq 0 exit /b !ERRORLEVEL!
    echo %GREEN%Services restarted successfully!%NC%
    
) else if "%COMMAND%"=="rebuild" (
    echo %YELLOW%Rebuilding all services...%NC%
    call :setup_env
    docker compose build
    if !ERRORLEVEL! neq 0 exit /b !ERRORLEVEL!
    echo %GREEN%Services rebuilt successfully!%NC%
    
) else if "%COMMAND%"=="logs" (
    set "SERVICE=%~2"
    echo %YELLOW%Showing logs for !SERVICE! or all services if none specified...%NC%
    docker compose logs -f !SERVICE!
    
) else if "%COMMAND%"=="ps" (
    echo %YELLOW%Listing running services...%NC%
    docker compose ps
    
) else if "%COMMAND%"=="shell" (
    set "SERVICE=%~2"
    if "!SERVICE!"=="" (
        echo %RED%Please specify a service name: frontend, audit-service, pptx-processor, or share-service%NC%
        exit /b 1
    )
    echo %YELLOW%Opening shell in !SERVICE!...%NC%
    docker compose exec !SERVICE! sh
    
) else if "%COMMAND%"=="env" (
    call :setup_env
    echo %GREEN%Environment variables set up successfully!%NC%
    
) else (
    REM Show help message for any other command
    echo.
    echo %CYAN%Docker Manager for PPTXTransed%NC%
    echo.
    echo Usage: docker-manager.bat [command]
    echo.
    echo Commands:
    echo   %GREEN%start%NC%     Start all services with Docker Compose
    echo   %GREEN%stop%NC%      Stop all services
    echo   %GREEN%restart%NC%   Restart all services
    echo   %GREEN%rebuild%NC%   Rebuild all services
    echo   %GREEN%logs%NC%      Show logs for all services (or specify a service)
    echo   %GREEN%ps%NC%        List running services
    echo   %GREEN%shell%NC%     Open a shell in a specific service container
    echo   %GREEN%env%NC%       Set up environment variables
    echo   %GREEN%help%NC%      Show this help message
    echo.
)

exit /b 0

:setup_env
REM Run the setup-env.js script using Node.js
node "%PROJECT_ROOT%\scripts\utils\setup-env.js"
exit /b 0

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