@echo off
REM Script to start the audit service for local testing on Windows

echo Starting Audit Service...

REM Check if the audit service directory exists
if not exist "audit-service" (
    echo Error: audit-service directory not found!
    exit /b 1
)

REM Navigate to the audit service directory
cd audit-service

REM Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Go is not installed or not in PATH!
    exit /b 1
)

REM Run the Go service
echo Running audit service on port 4006...
cd cmd\server && go run main.go

REM This script can be enhanced to include database setup, migrations, etc. 