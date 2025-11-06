#
# Reset Database Script (PowerShell)
# Drops and recreates the agent_database, then runs migrations
#
# Usage: 
#   PowerShell 7+: pwsh -File .\scripts\database\reset-database.ps1
#   Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\scripts\database\reset-database.ps1
#
# If you get "cannot be loaded because running scripts is disabled":
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#
# Or run directly with bypass:
#   powershell -ExecutionPolicy Bypass -File .\scripts\database\reset-database.ps1
#

# Exit on error
$ErrorActionPreference = "Stop"

# Database configuration (matches docker-compose.yml)
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "agent_database" }
$DB_USER = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "postgres" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }

Write-Host "==================================================" -ForegroundColor Red
Write-Host "Reset Database Script" -ForegroundColor Red
Write-Host "==================================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will DROP and RECREATE the database!" -ForegroundColor Red
Write-Host ""
Write-Host "Database: " -NoNewline
Write-Host $DB_NAME -ForegroundColor Yellow
Write-Host "Host: " -NoNewline
Write-Host "${DB_HOST}:${DB_PORT}" -ForegroundColor Yellow
Write-Host "User: " -NoNewline
Write-Host $DB_USER -ForegroundColor Yellow
Write-Host ""

# Check if psql is available locally
$psqlExists = Get-Command psql -ErrorAction SilentlyContinue

if ($psqlExists) {
    # Local psql available
    Write-Host "Using local PostgreSQL client..." -ForegroundColor Cyan
    $env:PGPASSWORD = $DB_PASSWORD
    
    # Terminate existing connections
    Write-Host "Terminating existing connections to '$DB_NAME'..." -ForegroundColor Yellow
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
    
    # Drop database if it exists
    Write-Host "Dropping database '$DB_NAME'..." -ForegroundColor Yellow
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    Write-Host "✓ Database '$DB_NAME' dropped" -ForegroundColor Green
    
    # Create database
    Write-Host "Creating database '$DB_NAME'..." -ForegroundColor Yellow
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    Write-Host "✓ Database '$DB_NAME' created successfully" -ForegroundColor Green
} else {
    # Use Docker
    Write-Host "Using Docker to access PostgreSQL..." -ForegroundColor Cyan
    
    # Terminate existing connections
    Write-Host "Terminating existing connections to '$DB_NAME'..." -ForegroundColor Yellow
    docker-compose exec -T postgres psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
    
    # Drop database if it exists
    Write-Host "Dropping database '$DB_NAME'..." -ForegroundColor Yellow
    docker-compose exec -T postgres psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    Write-Host "✓ Database '$DB_NAME' dropped" -ForegroundColor Green
    
    # Create database
    Write-Host "Creating database '$DB_NAME'..." -ForegroundColor Yellow
    docker-compose exec -T postgres psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    Write-Host "✓ Database '$DB_NAME' created successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Running migrations..." -ForegroundColor Yellow
Write-Host ""

# Change to database package directory and run migrations
Push-Location "..\..\packages\database"
try {
    pnpm run migration:run
    Write-Host ""
    Write-Host "✓ Migrations completed successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Migration failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Database Reset Complete" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "The database has been recreated and migrations have been applied." -ForegroundColor Cyan
Write-Host "You can now start the application." -ForegroundColor Cyan
Write-Host ""
