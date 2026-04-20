@echo off
echo Preparing Personal Finance Tracker...

REM 1. Check if Docker is running
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_running

echo Docker is not running. Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo Waiting for Docker to start (this may take a minute)...

:wait_for_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto wait_for_docker

echo Docker is now running!

:docker_running

REM 2. Navigate to project directory
cd /d "%~dp0"

echo Performing a clean restart...
REM 3. Stop and remove existing containers (preserves your data in volumes)
docker compose down

echo Building and starting containers...
REM 4. Rebuild and start in detached mode
docker compose up --build -d

echo.
echo Waiting for services to start...
timeout /t 5 /nobreak > NUL

echo Opening the application in your default web browser...
start http://localhost:5173

echo.
echo Personal Finance Tracker is now running with a fresh build!
echo You can safely close this window.
timeout /t 5
