@echo off
REM Create Database Script (Windows Batch)
REM Creates the agent_database if it doesn't already exist
REM
REM Usage: scripts\create-database.bat
REM

setlocal enabledelayedexpansion

REM Database configuration (matches docker-compose.yml)
if "%DB_NAME%"=="" set DB_NAME=agent_database
if "%DB_USERNAME%"=="" set DB_USERNAME=postgres
if "%DB_PASSWORD%"=="" set DB_PASSWORD=postgres
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=5432

echo ==================================================
echo Create Database Script
echo ==================================================
echo.
echo Database: %DB_NAME%
echo Host: %DB_HOST%:%DB_PORT%
echo User: %DB_USERNAME%
echo.

echo Checking if database exists...

REM Check if psql is available locally
where psql >nul 2>&1
if %errorlevel% equ 0 (
    echo Using local PostgreSQL...
    set PGPASSWORD=%DB_PASSWORD%
    
    REM Check if database exists
    for /f %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USERNAME% -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'"') do set DB_EXISTS=%%i
    
    if "!DB_EXISTS!"=="1" (
        echo [OK] Database '%DB_NAME%' already exists
    ) else (
        echo Creating database '%DB_NAME%'...
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USERNAME% -d postgres -c "CREATE DATABASE %DB_NAME%;"
        if %errorlevel% equ 0 (
            echo [OK] Database '%DB_NAME%' created successfully
        ) else (
            echo [ERROR] Failed to create database
            exit /b 1
        )
    )
) else (
    echo Using Docker to access PostgreSQL...
    
    REM Check if database exists
    for /f %%i in ('docker-compose exec -T postgres psql -U %DB_USERNAME% -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'"') do set DB_EXISTS=%%i
    
    if "!DB_EXISTS!"=="1" (
        echo [OK] Database '%DB_NAME%' already exists
    ) else (
        echo Creating database '%DB_NAME%'...
        docker-compose exec -T postgres psql -U %DB_USERNAME% -d postgres -c "CREATE DATABASE %DB_NAME%;"
        if %errorlevel% equ 0 (
            echo [OK] Database '%DB_NAME%' created successfully
        ) else (
            echo [ERROR] Failed to create database
            exit /b 1
        )
    )
)

echo.
echo ==================================================
echo Database Setup Complete
echo ==================================================
echo.
echo Next steps:
echo   1. Run migrations:
echo      cd packages\database ^&^& pnpm run migration:run
echo   2. Or generate a new migration:
echo      cd packages\database ^&^& pnpm run migration:generate .\src\migrations\MigrationName
echo.

endlocal
