# Developer Onboarding Guide

Complete setup guide for the eXpRealty Agent Service platform.

---

## Prerequisites

### Required Software

#### 1. **Node.js** - v20.19.0 or v22.16.0
- **Recommended**: Use Volta for automatic version management
  ```bash
  # Install Volta
  curl https://get.volta.sh | bash
  
  # Volta will automatically use the correct Node version from package.json
  ```
- **Alternative**: Use NVM
  ```bash
  # Install NVM
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  
  # Install and use the correct Node version
  nvm install
  nvm use
  ```

#### 2. **PNPM** - Package Manager
```bash
# Install via npm (after Node.js is installed)
npm install -g pnpm

# Or via Volta (recommended)
volta install pnpm
```

#### 3. **Docker & Docker Compose** - For PostgreSQL and Redis
- **macOS**: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: 
  ```bash
  # Docker Engine
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  
  # Docker Compose
  sudo apt-get install docker-compose-plugin
  ```
- **Windows**: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)

#### 4. **PowerShell** - For database scripts (cross-platform)
- **macOS/Linux**: 
  ```bash
  # Install PowerShell
  brew install --cask powershell  # macOS
  # Or see: https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux
  ```
- **Windows**: Built-in (use PowerShell 7+)

#### 5. **Git** - Version Control
```bash
# macOS
brew install git

# Linux
sudo apt-get install git

# Windows - Git for Windows
# https://git-scm.com/download/win
```

### Optional but Recommended

- **VS Code** - IDE with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - REST Client (for testing APIs)
  - Docker
- **Postman** - API testing (we provide a collection)
- **PostgreSQL Client** - Database management
  - pgAdmin, DBeaver, or TablePlus

---

## Initial Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd agent-service
```

### 2. Install Dependencies
```bash
# Install all workspace dependencies
pnpm install
```

### 3. Environment Configuration

Copy the sample environment file:
```bash
cp .env.sample .env
```

Edit `.env` with your local settings (defaults should work for local development):
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=agent_database

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
NODE_ENV=development
LOG_LEVEL=debug
```

### 4. Start Infrastructure Services

Start PostgreSQL and Redis containers:
```bash
docker compose up -d postgres redis
```

Verify containers are running:
```bash
docker compose ps
```

### 5. Database Setup

Create and initialize the database:
```bash
# Create database
pnpm db:create

# Reset database and remove old migrations (if any)
pnpm db:reset

# Generate initial migration (from packages/database directory)
cd packages/database
npm run migration:generate --name=InitialSchema
cd ../..

# Run migrations
pnpm migration:run
```

### 6. Build All Packages
```bash
pnpm build
```

### 7. Start Services

Start all services in development mode:
```bash
pnpm dev
```

Or start individual services:
```bash
# Agent Service only
pnpm --filter agent-service dev

# Orchestrator only
pnpm --filter orchestrator dev
```

---

## Verification

### Check Services are Running

**Agent Service**: http://localhost:3000
```bash
curl http://localhost:3000/health
```

**Orchestrator**: http://localhost:3001
```bash
curl http://localhost:3001/health
```

**Swagger API Documentation**: http://localhost:3000/api

### Run Tests

```bash
# Unit tests
pnpm test:unit

# E2E tests (requires services to be running)
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

### Test API with Postman

Import the Postman collection:
```bash
# File location: ./postman_collection.json
```

In Postman:
1. Import `postman_collection.json`
2. Create environment with variable: `baseUrl` = `http://localhost:3000`
3. Run the collection to test all endpoints

---

## Project Structure

```
agent-service/
├── packages/                    # Shared packages
│   ├── shared-domain/          # Zod validation schemas, types
│   ├── database/               # TypeORM entities, migrations
│   ├── logger/                 # Winston logging utilities
│   ├── config/                 # Configuration management
│   └── cache/                  # Redis cache wrapper
│
├── services/                    # Microservices
│   ├── agent-service/          # Main agent service (port 3000)
│   └── orchestrator/           # API Gateway (port 3001)
│
├── docs/                        # Architecture documentation
├── scripts/                     # Utility scripts
├── test/                        # Shared test utilities
└── postman_collection.json     # API test collection
```

---

## Common Commands

### Development Workflow

```bash
# Start development servers
pnpm dev

# Build all packages
pnpm build

# Build only packages (shared libraries)
pnpm build:packages

# Build only services
pnpm build:services

# Run linting
pnpm lint

# Fix linting and formatting issues
pnpm lint:fix

# Type checking (no emit)
pnpm check
```

### Database Management

```bash
# Create database
pnpm db:create

# Reset database (drops all tables and migrations)
pnpm db:reset

# Generate migration (from packages/database)
cd packages/database
npm run migration:generate --name=MigrationName

# Run pending migrations
pnpm migration:run

# Revert last migration
cd packages/database
npm run migration:revert

# Show migration status
cd packages/database
npm run migration:show
```

### Testing

```bash
# Unit tests
pnpm test:unit

# Unit tests in watch mode
pnpm test:unit:watch

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:coverage

# Test specific service
pnpm --filter agent-service test:unit
```

### Package Management

```bash
# Check for version mismatches
pnpm sync:check

# Fix version mismatches
pnpm sync:fix

# Update dependencies
pnpm sync:update

# Check workspace manifests
pnpm manifests-lint

# Fix workspace manifests
pnpm manifests-fix
```

---

## Architecture Overview

### Technology Stack

- **Runtime**: Node.js 22.16.0 (managed by Volta)
- **Language**: TypeScript 5.8.3
- **Framework**: NestJS 10.3.0
- **Database**: PostgreSQL 15 with TypeORM 0.3.20
- **Cache**: Redis 7
- **Validation**: Zod 3.23.8
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest, Supertest

### Key Patterns

- **Zod-First Validation**: All DTOs validated with Zod schemas from `@exprealty/shared-domain`
- **RFC 9457 Problem Details**: Standardized error responses
- **i18n Error Keys**: Machine-readable error types for internationalization
- **Repository Pattern**: Data access through TypeORM repositories
- **Schema-Driven**: All tables in `core` schema with singular names

### Database Schema

All entities use:
- **Schema**: `core`
- **Table Names**: Singular (e.g., `agent`, not `agents`)
- **Primary Keys**: UUID (for most) or bigint (for regions)
- **Timestamps**: `created_at`, `updated_at` with timezone

---

## Development Guidelines

### Code Style

- **ESLint**: Enforced on commit via Husky
- **Prettier**: Auto-formatting on save
- **TypeScript**: Strict mode enabled
- **Commit Messages**: Conventional commits format recommended

### Adding New Endpoints

1. Define Zod schema in `packages/shared-domain/src/entities/`
2. Create DTO in service module (`dto/` folder)
3. Implement service logic
4. Create controller with Swagger decorators
5. Add validation with `ZodValidationPipe`
6. Add tests (unit + e2e)
7. Update Postman collection

### Database Migrations

Always create migrations for schema changes:
```bash
cd packages/database
npm run migration:generate --name=DescriptiveChangeName
```

Never use `synchronize: true` in production!

---

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres
```

### Migration Failures
```bash
# Reset database and regenerate migrations
pnpm db:reset
cd packages/database
npm run migration:generate --name=InitialSchema
cd ../..
pnpm migration:run
```

### TypeORM Import Errors
- Ensure all entity imports in `core/` folder use `./` not `../`
- Check that `.js` extensions are in import paths (ESM requirement)

### Build Failures
```bash
# Clean node_modules and reinstall
rm -rf node_modules packages/*/node_modules services/*/node_modules
pnpm install

# Clean build artifacts
rm -rf packages/*/dist services/*/dist

# Rebuild
pnpm build
```

---

## Additional Resources

- **Architecture Docs**: See `docs/ARCHITECTURE-OVERVIEW.md`
- **Domain Model**: See `docs/DOMAIN-MODEL-REFERENCE.md`
- **ADRs**: See `docs/ADRs/` for architectural decisions
- **API Documentation**: http://localhost:3000/api (when service is running)
- **Postman Collection**: `postman_collection.json`

---

## Getting Help

- Check existing documentation in `docs/`
- Review Architecture Decision Records (ADRs)
- Ask team members via Slack/Teams
- Check existing issues in the repository

---

## Next Steps

After completing setup:

1. Review the architecture documentation
2. Explore the Swagger API at http://localhost:3000/api
3. Run the Postman collection tests
4. Read through key entity models in `packages/shared-domain`
5. Review existing endpoints in `services/agent-service/src/modules`
6. Start with a small task to familiarize yourself with the codebase

---

**Last Updated**: November 5, 2025
