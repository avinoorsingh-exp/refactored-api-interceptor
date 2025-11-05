#
# Create Database Script (PowerShell)
# Creates the agent_database if it doesn't already exist
#
# Usage: 
#   PowerShell 7+: pwsh -File .\scripts\create-database.ps1
#   Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\scripts\create-database.ps1
#
# If you get "cannot be loaded because running scripts is disabled":
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#
# Or run directly with bypass:
#   powershell -ExecutionPolicy Bypass -File .\scripts\create-database.ps1
#

# Exit on error
$ErrorActionPreference = "Stop"

# Database configuration (matches docker-compose.yml)
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "agent_database" }
$DB_USER = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "postgres" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "Create Database Script" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Database: " -NoNewline
Write-Host $DB_NAME -ForegroundColor Green
Write-Host "Host: " -NoNewline
Write-Host "${DB_HOST}:${DB_PORT}" -ForegroundColor Green
Write-Host "User: " -NoNewline
Write-Host $DB_USER -ForegroundColor Green
Write-Host ""

# Check if database exists and create if needed
Write-Host "Checking if database exists..." -ForegroundColor Yellow

# Check if psql is available locally
$psqlExists = Get-Command psql -ErrorAction SilentlyContinue

if ($psqlExists) {
    # Local psql available
    $env:PGPASSWORD = $DB_PASSWORD
    
    # Check if database exists
    $dbExists = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'"
    
    if ($dbExists -eq "1") {
        Write-Host "✓ Database '$DB_NAME' already exists" -ForegroundColor Green
    } else {
        Write-Host "Creating database '$DB_NAME'..." -ForegroundColor Yellow
        & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
        Write-Host "✓ Database '$DB_NAME' created successfully" -ForegroundColor Green
    }
} else {
    # Use Docker
    Write-Host "Using Docker to access PostgreSQL..." -ForegroundColor Cyan
    
    # Check if database exists
    $dbExists = docker-compose exec -T postgres psql -U $DB_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'"
    
    if ($dbExists -eq "1") {
        Write-Host "✓ Database '$DB_NAME' already exists" -ForegroundColor Green
    } else {
        Write-Host "Creating database '$DB_NAME'..." -ForegroundColor Yellow
        docker-compose exec -T postgres psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
        Write-Host "✓ Database '$DB_NAME' created successfully" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Database Setup Complete" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run migrations:" -ForegroundColor Cyan
Write-Host "     cd packages\database; pnpm run migration:run" -ForegroundColor Green
Write-Host "  2. Or generate a new migration:" -ForegroundColor Cyan
Write-Host "     cd packages\database; pnpm run migration:generate .\src\migrations\MigrationName" -ForegroundColor Green
Write-Host ""
