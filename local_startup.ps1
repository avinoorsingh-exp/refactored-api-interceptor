#
# Startup Script (PowerShell)
# Installs dependencies, builds project, starts Docker Compose, and runs clean migration
#
# Usage:
#   PowerShell 7+: pwsh -File .\scripts\startup.ps1
#   Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\scripts\startup.ps1
#

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step {
    param([string]$Message)
    Write-Host "`n==================================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# If script is at root, use scriptDir as projectRoot; otherwise go up one level
$packageJsonPath = Join-Path $scriptDir "package.json"
if (Test-Path $packageJsonPath) {
    $projectRoot = $scriptDir
} else {
    $projectRoot = Split-Path -Parent $scriptDir
}

Push-Location $projectRoot

try {
    Write-Step "Agent Service - Startup Script"
    Write-Host "This script will:" -ForegroundColor White
    Write-Host "  1. Check prerequisites (pnpm, docker)" -ForegroundColor White
    Write-Host "  2. Create environment files if missing" -ForegroundColor White
    Write-Host "  3. Install dependencies" -ForegroundColor White
    Write-Host "  4. Build the project" -ForegroundColor White
    Write-Host "  5. Start Docker Compose services" -ForegroundColor White
    Write-Host "  6. Wait for services to be healthy" -ForegroundColor White
    Write-Host "  7. Reset database and run migrations (WARNING: deletes all data)" -ForegroundColor White
    Write-Host ""

    # Step 1: Check prerequisites
    Write-Step "Step 1: Checking Prerequisites"

    # Check pnpm
    Write-Info "Checking for pnpm..."
    $pnpmExists = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmExists) {
        Write-Error "pnpm is not installed. Please install it first:"
        Write-Host "  npm install -g pnpm" -ForegroundColor Yellow
        exit 1
    }
    $pnpmVersion = pnpm --version
    Write-Success "pnpm found (version $pnpmVersion)"

    # Check docker
    Write-Info "Checking for docker..."
    $dockerExists = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerExists) {
        Write-Error "Docker is not installed or not in PATH. Please install Docker Desktop."
        exit 1
    }
    Write-Success "Docker found"

    # Check docker-compose
    Write-Info "Checking for docker-compose..."
    $dockerComposeExists = Get-Command docker-compose -ErrorAction SilentlyContinue
    if (-not $dockerComposeExists) {
        # Try 'docker compose' (newer syntax)
        $testResult = docker compose version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "docker-compose is not available. Please install Docker Desktop."
            exit 1
        }
        $dockerComposeCmd = "docker compose"
    } else {
        $dockerComposeCmd = "docker-compose"
    }
    Write-Success "docker-compose found"

    # Check if Docker is running
    Write-Info "Checking if Docker is running..."
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    Write-Success "Docker is running"

    # Step 2: Create environment files if missing
    Write-Step "Step 2: Setting Up Environment Files"
    
    # Root .env file
    $rootEnvPath = Join-Path $projectRoot ".env"
    if (-not (Test-Path $rootEnvPath)) {
        Write-Info "Creating root .env file..."
        $rootEnvContent = @"
# Environment Configuration
NODE_ENV=local
LOG_LEVEL=info
LOG_DIR=./logs
AWS_REGION=us-east-1

# Database Configuration (for local development - connects to Docker container)
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=agent_database
DB_SSL=false

# Redis Configuration
REDIS_URL=redis://localhost:6379
"@
        $rootEnvContent | Out-File -FilePath $rootEnvPath -Encoding utf8
        Write-Success "Created root .env file"
    } else {
        Write-Success "Root .env file already exists"
        # Ensure DB_SSL=false is set in existing .env file
        $envContent = Get-Content $rootEnvPath -Raw
        if ($envContent -notmatch "DB_SSL\s*=") {
            Write-Info "Adding DB_SSL=false to existing .env file..."
            Add-Content -Path $rootEnvPath -Value "`nDB_SSL=false"
            Write-Success "Added DB_SSL=false to root .env file"
        }
    }

    # Agent Service .env file
    $agentServiceDir = Join-Path $projectRoot "services\agent-service"
    $agentServiceEnvPath = Join-Path $agentServiceDir ".env.agentservice"
    if (-not (Test-Path $agentServiceEnvPath)) {
        Write-Info "Creating agent-service .env.agentservice file..."
        if (-not (Test-Path $agentServiceDir)) {
            New-Item -ItemType Directory -Path $agentServiceDir -Force | Out-Null
        }
        $agentServiceEnvContent = @"
# Agent Service Configuration
NODE_ENV=local
PORT=3000

# Database Configuration (for Docker container - uses service name)
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=agent_database
DB_SSL=false

# Kafka Configuration
KAFKA_BROKERS=dev-kafka-cluster.expenterprise.local:9092
KAFKA_CLIENT_ID=agent-service
KAFKA_CONSUMER_GROUP_ID=agent-service-group
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=ecastro
KAFKA_SASL_PASSWORD=agDx7ndAzaud3yQVjsoGzHy76u08T85R
KAFKA_SSL=true
"@
        $agentServiceEnvContent | Out-File -FilePath $agentServiceEnvPath -Encoding utf8
        Write-Success "Created agent-service .env.agentservice file"
    } else {
        Write-Success "Agent-service .env.agentservice file already exists"
        # Ensure DB_SSL=false is set in existing .env file
        $envContent = Get-Content $agentServiceEnvPath -Raw
        if ($envContent -notmatch "DB_SSL\s*=") {
            Write-Info "Adding DB_SSL=false to existing agent-service .env file..."
            Add-Content -Path $agentServiceEnvPath -Value "`nDB_SSL=false"
            Write-Success "Added DB_SSL=false to agent-service .env file"
        }
    }

    # Orchestrator .env file
    $orchestratorDir = Join-Path $projectRoot "services\orchestrator"
    $orchestratorEnvPath = Join-Path $orchestratorDir ".env.orchestrator"
    if (-not (Test-Path $orchestratorEnvPath)) {
        Write-Info "Creating orchestrator .env.orchestrator file..."
        if (-not (Test-Path $orchestratorDir)) {
            New-Item -ItemType Directory -Path $orchestratorDir -Force | Out-Null
        }
        $orchestratorEnvContent = @"
# Orchestrator Service Configuration
NODE_ENV=local
PORT=8081

# Agent Service Client Configuration (for Docker container - uses service name)
AGENT_SERVICE_URL=http://agent-service:3000
AGENT_SERVICE_TRANSPORT=rest
"@
        $orchestratorEnvContent | Out-File -FilePath $orchestratorEnvPath -Encoding utf8
        Write-Success "Created orchestrator .env.orchestrator file"
    } else {
        Write-Success "Orchestrator .env.orchestrator file already exists"
    }

    # Step 3: Install dependencies
    Write-Step "Step 2: Installing Dependencies"
    Write-Info "Running pnpm install..."
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
    Write-Success "Dependencies installed"

    # Step 4: Build project
    Write-Step "Step 4: Building Project"
    Write-Info "Building packages and services..."
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit 1
    }
    Write-Success "Project built successfully"

    # Step 5: Start Docker Compose
    Write-Step "Step 5: Starting Docker Compose Services"
    Write-Info "Starting postgres, redis, agent-service, and agent-orchestrator..."
    
    # Stop any existing containers first
    Write-Info "Stopping any existing containers..."
    Invoke-Expression "$dockerComposeCmd down" | Out-Null

    # Start services
    Write-Info "Starting services..."
    Invoke-Expression "$dockerComposeCmd up -d postgres redis"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start postgres and redis"
        exit 1
    }

    # Wait for postgres to be healthy
    Write-Info "Waiting for PostgreSQL to be healthy..."
    $maxAttempts = 30
    $attempt = 0
    $postgresHealthy = $false

    while ($attempt -lt $maxAttempts -and -not $postgresHealthy) {
        Start-Sleep -Seconds 2
        $healthCheck = Invoke-Expression "$dockerComposeCmd exec -T postgres pg_isready -U postgres" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $postgresHealthy = $true
            Write-Success "PostgreSQL is ready"
        } else {
            $attempt++
            Write-Host "." -NoNewline -ForegroundColor Yellow
        }
    }

    if (-not $postgresHealthy) {
        Write-Error "PostgreSQL failed to become healthy after $maxAttempts attempts"
        exit 1
    }

    # Wait for redis to be healthy
    Write-Info "Waiting for Redis to be healthy..."
    $attempt = 0
    $redisHealthy = $false

    while ($attempt -lt $maxAttempts -and -not $redisHealthy) {
        Start-Sleep -Seconds 2
        $healthCheck = Invoke-Expression "$dockerComposeCmd exec -T redis redis-cli ping" 2>&1
        if ($LASTEXITCODE -eq 0 -and $healthCheck -match "PONG") {
            $redisHealthy = $true
            Write-Success "Redis is ready"
        } else {
            $attempt++
            Write-Host "." -NoNewline -ForegroundColor Yellow
        }
    }

    if (-not $redisHealthy) {
        Write-Error "Redis failed to become healthy after $maxAttempts attempts"
        exit 1
    }

    # Start application services
    Write-Info "Starting agent-service and agent-orchestrator..."
    Invoke-Expression "$dockerComposeCmd up -d agent-service agent-orchestrator"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start application services"
        exit 1
    }
    Write-Success "All Docker services started"

    # Step 6: Reset database and run migrations
    Write-Step "Step 6: Resetting Database and Running Migrations"
    Write-Warning "WARNING: This will DROP and RECREATE the database!"
    Write-Warning "All existing data will be lost."
    Write-Info "This ensures a clean, consistent state for local development."
    
    # Set environment variables for database connection
    $env:DB_HOST = "localhost"
    $env:DB_PORT = "5433"
    $env:DB_USERNAME = "postgres"
    $env:DB_PASSWORD = "postgres"
    $env:DB_NAME = "agent_database"
    $env:DB_SSL = "false"

    # Run reset database script
    $resetScriptPath = Join-Path $projectRoot "scripts\database\reset-database.ps1"
    if (-not (Test-Path $resetScriptPath)) {
        Write-Error "Reset database script not found at $resetScriptPath"
        exit 1
    }

    Write-Info "Executing database reset script..."
    & $resetScriptPath
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Database reset failed"
        exit 1
    }

    Write-Success "Database reset and migrations completed successfully"

    # Final summary
    Write-Step "Startup Complete!"
    Write-Host "All services are running:" -ForegroundColor Green
    Write-Host "  - PostgreSQL: localhost:5433" -ForegroundColor Cyan
    Write-Host "  - Redis: localhost:6379" -ForegroundColor Cyan
    Write-Host "  - Agent Service: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  - Agent Orchestrator: http://localhost:3001" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Swagger Documentation:" -ForegroundColor Yellow
    Write-Host "  - Agent Service: http://localhost:3000/api" -ForegroundColor Cyan
    Write-Host "  - Via Orchestrator: http://localhost:3001/api" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To view logs:" -ForegroundColor Yellow
    Write-Host "  $dockerComposeCmd logs -f" -ForegroundColor Green
    Write-Host ""
    Write-Host "To stop services:" -ForegroundColor Yellow
    Write-Host "  $dockerComposeCmd down" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: Database is reset on each startup to ensure clean state." -ForegroundColor Cyan
    Write-Host ""

} catch {
    Write-Error "Startup failed: $_"
    exit 1
} finally {
    Pop-Location
}

