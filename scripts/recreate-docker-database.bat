@echo off
REM Recreate Docker Database Script (Windows Batch)
REM Stops Docker Compose, removes the PostgreSQL volume, and recreates containers
REM
REM Usage: scripts\recreate-docker-database.bat
REM

setlocal enabledelayedexpansion

echo ==================================================
echo Recreate Docker Database
echo ==================================================
echo.
echo WARNING: This will delete all data in the PostgreSQL database!
echo.

set /p CONFIRM="Are you sure you want to continue? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo Operation cancelled.
    exit /b 0
)

echo.

REM Step 1: Stop Docker Compose
echo [1/4] Stopping Docker Compose containers...
docker-compose down
if %errorlevel% neq 0 (
    echo [ERROR] Failed to stop containers
    exit /b 1
)
echo [OK] Containers stopped
echo.

REM Step 2: Find PostgreSQL volume
echo [2/4] Finding PostgreSQL volume...
for /f "tokens=*" %%i in ('docker volume ls --format "{{.Name}}" ^| findstr pgdata') do (
    set PGDATA_VOLUME=%%i
    goto :found_volume
)

echo No pgdata volume found (this is okay if it's the first run)
goto :recreate_containers

:found_volume
echo Found volume: !PGDATA_VOLUME!
echo.

REM Step 3: Remove the volume
echo [3/4] Removing PostgreSQL volume: !PGDATA_VOLUME!...
docker volume rm !PGDATA_VOLUME!
if %errorlevel% neq 0 (
    echo [WARNING] Failed to remove volume (it may be in use)
) else (
    echo [OK] Volume removed
)
echo.

:recreate_containers
REM Step 4: Recreate containers
echo [4/4] Recreating Docker containers...
docker-compose up -d --force-recreate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to recreate containers
    exit /b 1
)
echo [OK] Containers recreated

echo.
echo ==================================================
echo Docker Database Recreated Successfully
echo ==================================================
echo.
echo Next steps:
echo   1. Wait for PostgreSQL to be ready (check with: docker-compose ps)
echo   2. Run migrations:
echo      cd packages\database ^&^& pnpm run migration:run
echo   3. Or generate a new migration:
echo      cd packages\database ^&^& pnpm run migration:generate .\src\migrations\MigrationName
echo.

endlocal
