#
# Recreate Docker Database Script (PowerShell)
# Stops Docker Compose, removes the PostgreSQL volume, and recreates containers
#
# Usage:
#   PowerShell 7+: pwsh -File .\scripts\recreate-docker-database.ps1
#   Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\scripts\recreate-docker-database.ps1
#
# If you get "cannot be loaded because running scripts is disabled":
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#
# Or run directly with bypass:
#   powershell -ExecutionPolicy Bypass -File .\scripts\recreate-docker-database.ps1
#

# Exit on error
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "Recreate Docker Database" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This will delete all data in the PostgreSQL database!" -ForegroundColor Red
Write-Host ""

# Prompt for confirmation
$confirmation = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Step 1: Stop Docker Compose
Write-Host "[1/4] Stopping Docker Compose containers..." -ForegroundColor Yellow
docker-compose down
Write-Host "✓ Containers stopped" -ForegroundColor Green
Write-Host ""

# Step 2: List volumes to find the correct one
Write-Host "[2/4] Finding PostgreSQL volume..." -ForegroundColor Yellow
$volumes = docker volume ls --format "{{.Name}}" | Select-String "pgdata"
if ($volumes) {
    Write-Host "Found volume(s):" -ForegroundColor Cyan
    $volumes | ForEach-Object { Write-Host "  - $_" -ForegroundColor Cyan }
    
    # Use the first match or a specific pattern
    $pgdataVolume = $volumes | Select-Object -First 1
    
    # Step 3: Remove the volume
    Write-Host ""
    Write-Host "[3/4] Removing PostgreSQL volume: $pgdataVolume..." -ForegroundColor Yellow
    docker volume rm $pgdataVolume
    Write-Host "✓ Volume removed" -ForegroundColor Green
} else {
    Write-Host "No pgdata volume found (this is okay if it's the first run)" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Recreate containers
Write-Host "[4/4] Recreating Docker containers..." -ForegroundColor Yellow
docker-compose up -d --force-recreate
Write-Host "✓ Containers recreated" -ForegroundColor Green

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Docker Database Recreated Successfully" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Wait for PostgreSQL to be ready (check with docker-compose ps)" -ForegroundColor Cyan
Write-Host "  2. Run migrations:" -ForegroundColor Cyan
Write-Host "     cd packages\database; pnpm run migration:run" -ForegroundColor Green
Write-Host "  3. Or generate a new migration:" -ForegroundColor Cyan
Write-Host "     cd packages\database; pnpm run migration:generate .\src\migrations\MigrationName" -ForegroundColor Green
Write-Host ""
