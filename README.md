# eXpRealty Platform - Architecture Overview

**Generated:** October 29, 2025  
**Purpose:** Comprehensive architecture reference for AI-assisted development

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Architectural Patterns](#architectural-patterns)
5. [Services Architecture](#services-architecture)
6. [Package Architecture](#package-architecture)
7. [Data Layer](#data-layer)
8. [Domain Model](#domain-model)
9. [Infrastructure](#infrastructure)
10. [Key Design Decisions](#key-design-decisions)

---

## System Overview

The eXpRealty platform is a **microservices-based real estate agent management system** built as a **PNPM monorepo**. It manages agents, companies, offices, licenses, and related business entities for a real estate organization.

### Core Capabilities

- **Agent Management**: Complete lifecycle management of real estate agents
- **Company & Office Management**: Organizational hierarchy and relationships
- **License Tracking**: Real estate license management and compliance
- **Payment & Compensation**: Pay plans, payment settings, and fee structures
- **External System Integration**: Reference management for external systems
- **Public Profiles**: Agent public-facing information and social media
- **Document Management**: Artifacts, approvals, and compliance documents

### Architecture Style

- **Microservices**: Loosely coupled services with clear boundaries
- **Domain-Driven Design**: Rich domain models with business logic
- **Event-Driven** (planned): Kafka integration for async communication
- **API Gateway Pattern**: Orchestrator service as BFF (Backend for Frontend)
- **Repository Pattern**: Data access abstraction with TypeORM

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 22.16.0 | JavaScript runtime (managed by Volta) |
| **Language** | TypeScript | 5.8.3 | Type-safe development |
| **Package Manager** | PNPM | Latest | Workspace management |
| **Framework** | NestJS | 10.3.0 | Microservices framework |
| **Database** | PostgreSQL | 15 | Primary data store |
| **ORM** | TypeORM | 0.3.20 | Database abstraction |
| **Cache** | Redis | 7 | Distributed caching |
| **Validation** | Zod | 3.23.8 | Runtime type validation |

### Development Tools

- **Build**: TSC (TypeScript Compiler), TSup, Nx
- **Testing**: Jest, Supertest, MSW (Mock Service Worker)
- **Linting**: ESLint 9, Prettier
- **Git Hooks**: Husky, lint-staged
- **Monorepo**: Lerna, Manypkg, Syncpack
- **Documentation**: API Extractor, TSDoc

---

## Monorepo Structure

```
exprealty/
├── packages/                    # Shared libraries
│   ├── shared-domain/          # Domain models (Zod schemas)
│   ├── database/               # TypeORM entities & migrations
│   ├── logger/                 # Winston logging + OpenTelemetry
│   ├── config/                 # Environment configuration
│   └── cache/                  # Redis cache abstraction
│
├── services/                    # Microservices
│   ├── agent-service/          # Agent domain service
│   └── orchestrator/           # API Gateway / BFF
│
├── docs/                        # Documentation
│   ├── ADRs/                   # Architecture Decision Records
│   ├── specs/                  # Feature specifications
│   └── roles/                  # AI assistant prompts
│
├── scripts/                     # Utility scripts
├── test/                        # Shared test utilities
└── [config files]              # Root-level configs
```

### Workspace Configuration

**pnpm-workspace.yaml:**
```yaml
packages:
  - "packages/*"
  - "services/*"
  - "apps/*"
```

**Key Features:**
- Workspace protocol for internal dependencies (`workspace:*`)
- Shared dev dependencies at root
- Per-package build and test scripts
- Unified linting and formatting

---

## Architectural Patterns

### 1. Domain-Driven Design (DDD)

**Separation of Concerns:**
- **Domain Layer** (`@exprealty/shared-domain`): Pure business logic, validation rules
- **Persistence Layer** (`@exprealty/database`): Database mapping, migrations
- **Application Layer** (services): Use cases, orchestration

**See:** [ADR-001: Database Entity Separation](./docs/ADRs/001-database-entity-separation.md)

### 2. Base/Expanded Schema Pattern

**Performance Optimization:**
- **Base Schemas**: Minimal fields for list views (fast queries)
- **Expanded Schemas**: Full object graphs for detail views (eager loading)

**Example:**
```typescript
// Fast list query
AgentBaseSchema → SELECT id, firstName, lastName FROM agents

// Complete detail query
AgentExpandedSchema → SELECT * FROM agents 
                      LEFT JOIN agent_company 
                      LEFT JOIN addresses
```

**See:** [ADR-002: Base and Expanded Schema Pattern](./docs/ADRs/002-base-expanded-schema-pattern.md)

### 3. Repository Pattern

**Data Access Abstraction:**
- TypeORM repositories wrapped in service layer
- Domain types returned (not entities)
- Validation at boundaries

### 4. API Gateway (BFF)

**Orchestrator Service:**
- Single entry point for clients
- Request routing and aggregation
- Cross-cutting concerns (auth, logging, error handling)

---

## Services Architecture

### Service: agent-service

**Port:** 3000 (Docker), 8080 (default)  
**Purpose:** Core agent domain service  
**Status:** Minimal implementation (health check only)

**Structure:**
```
services/agent-service/
├── src/
│   ├── controllers/
│   │   └── agent.controller.ts      # REST endpoints
│   ├── core/
│   │   ├── config.module.ts         # NestJS config
│   │   ├── config.service.ts        # Config service
│   │   └── configuration.ts         # Config schema
│   ├── common/
│   │   └── zod-validation.pipe.ts   # Validation pipe
│   ├── app.module.ts                # Root module
│   └── main.ts                      # Bootstrap
├── test/                            # E2E tests
├── Dockerfile                       # Container image
└── package.json
```

**Current Endpoints:**
- `GET /v1/agent/health` → Health check

**Planned Features:**
- Agent CRUD operations
- License management
- Relationship management
- Event publishing (Kafka)

### Service: orchestrator

**Port:** 3001 (Docker), 8081 (default)  
**Purpose:** API Gateway / Backend for Frontend  
**Status:** Proxy implementation with RFC 9457 error handling

**Structure:**
```
services/orchestrator/
├── src/
│   ├── controllers/
│   │   ├── orchestrator.controller.ts       # Health check
│   │   └── agent-service.controller.ts      # Proxy to agent-service
│   ├── clients/
│   │   └── agent-service/
│   │       ├── agent-service.client.ts      # HTTP client interface
│   │       ├── agent-service.client.rest.ts # REST implementation
│   │       └── agent-service.factory.ts     # Client factory
│   ├── common/
│   │   ├── ecs-http-client.ts              # HTTP client wrapper
│   │   ├── endpoint.ts                      # Endpoint utilities
│   │   ├── headers.ts                       # Header utilities
│   │   ├── problem-details.filter.ts        # RFC 9457 errors
│   │   └── zod-validation.pipe.ts          # Validation
│   ├── core/
│   │   ├── config.module.ts
│   │   ├── config.service.ts
│   │   ├── configuration.ts
│   │   └── logger.service.ts               # Winston logger
│   ├── app.module.ts
│   └── main.ts
└── test/
```

**Current Endpoints:**
- `GET /v1/health` → Orchestrator health
- `ALL /v1/agent/*` → Proxy to agent-service

**Features:**
- Catch-all proxy pattern (`@All('*')`)
- RFC 9457 Problem Details error format
- Request/response logging
- Header forwarding
- Factory pattern for client management

---

## Package Architecture

### Package: @exprealty/shared-domain

**Purpose:** Canonical domain models and validation  
**Type:** Pure TypeScript + Zod  
**Exports:** ESM only

**Structure:**
```
packages/shared-domain/src/
├── entities/              # Domain entity schemas (50+ files)
│   ├── agent.ts          # Agent domain model
│   ├── company.ts        # Company domain model
│   ├── office.ts         # Office domain model
│   └── ...
├── value-objects/        # Branded types & validation
│   ├── email.ts          # Email validation
│   ├── phone-number.ts   # Phone validation
│   ├── postal-code.ts    # Postal code validation
│   ├── name.ts           # Name validation
│   └── ...
├── common/               # Shared utilities
│   ├── enums.ts          # Enums (CountryCode, etc.)
│   ├── errors.ts         # Error types
│   ├── problem-details.ts # RFC 9457 types
│   ├── paging.ts         # Pagination types
│   └── logging.ts        # Logging types
└── index.ts              # Public API
```

**Key Patterns:**
```typescript
// Base schema (list views)
export const AgentBaseSchema = z.object({
  id: z.string().uuid(),
  firstName: NameBranded,
  lastName: NameBranded,
  // ... minimal fields
})

// Expanded schema (detail views)
export const AgentExpandedSchema = AgentBaseSchema.extend({
  agentCompany: z.lazy(() => AgentCompanyBaseSchema).optional(),
  addresses: z.lazy(() => z.array(AgentAddressBaseSchema)).optional(),
})

// Type inference
export type Agent = z.infer<typeof AgentExpandedSchema>
```

**Dependencies:**
- `zod`: Schema validation
- `uuid`: UUID generation

### Package: @exprealty/database

**Purpose:** TypeORM entities and migrations  
**Type:** TypeScript + TypeORM decorators  
**Exports:** ESM only

**Structure:**
```
packages/database/src/
├── entities/              # TypeORM entities (50+ files)
│   ├── agent.entity.ts
│   ├── company.entity.ts
│   └── ...
├── migrations/            # TypeORM migrations
│   └── 1761576416125-CompleteSchema.ts
├── data-source.ts         # TypeORM DataSource config
└── index.ts               # Public API
```

**Key Patterns:**
```typescript
@Entity('agents')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string

  @Column({ name: 'agent_company_id', type: 'uuid' })
  agentCompanyId!: string

  @ManyToOne(() => AgentCompanyEntity)
  @JoinColumn({ name: 'agent_company_id' })
  agentCompany?: AgentCompanyEntity
}
```

**DataSource Configuration:**
```typescript
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'agent_database',
  entities: [/* all entities */],
  migrations: ['./src/migrations/*.ts'],
  synchronize: false, // NEVER in production
  logging: ['error'],
})
```

**Dependencies:**
- `typeorm`: ORM framework
- `pg`: PostgreSQL driver
- `@exprealty/shared-domain`: Domain types

### Package: @exprealty/logger

**Purpose:** Structured logging with Winston + OpenTelemetry  
**Type:** TypeScript wrapper  
**Exports:** ESM with subpath exports

**Features:**
- Winston logger with daily rotation
- Console output (dev only)
- File logging with rotation
- OpenTelemetry metrics integration
- NestJS-compatible adapter

**Usage:**
```typescript
import { createLogger, NestWinstonLogger } from '@exprealty/logger'

const logger = createLogger({
  service: 'agent-service',
  level: 'info',
  logDir: './logs',
  env: 'production',
})

logger.info('Agent created', { agentId: '123' })
```

### Package: @exprealty/config

**Purpose:** Environment configuration with Zod validation  
**Type:** TypeScript utility  
**Exports:** ESM

**Features:**
- Multi-level .env loading (repo → service → explicit)
- Zod schema validation
- Type-safe config objects
- Secret redaction for logging

**Usage:**
```typescript
import { loadConfig, BaseConfig } from '@exprealty/config'

const ConfigSchema = BaseConfig.extend({
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
})

const config = loadConfig(ConfigSchema)
```

### Package: @exprealty/cache

**Purpose:** Redis cache abstraction  
**Type:** TypeScript wrapper around ioredis  
**Exports:** ESM

**Features:**
- Key prefixing
- TTL management
- Get-or-set pattern
- Health checks
- Statistics

**Usage:**
```typescript
import { createCache } from '@exprealty/cache'

const cache = createCache({
  redisUrl: 'redis://localhost:6379',
  keyPrefix: 'exprealty',
  defaultTTL: 3600,
})

await cache.set('agent:123', agentData, 300)
const agent = await cache.get('agent:123')
```

---

## Data Layer

### Database Schema

**PostgreSQL 15** with **50+ tables** organized by domain:

#### Core Entities
- `agents` - Real estate agents
- `companies` - Real estate companies
- `offices` - Office locations
- `agent_companies` - Agent-company relationships

#### Address & Location
- `addresses` - Physical addresses
- `agent_addresses` - Agent address associations
- `office_addresses` - Office address associations
- `active_locations` - Active location tracking
- `countries`, `regions`, `states` - Geographic hierarchy

#### Licensing & Compliance
- `licenses` - Real estate licenses
- `license_events` - License lifecycle events
- `lifecycle_events` - Agent lifecycle events
- `approvals` - Approval workflows

#### Compensation & Payments
- `pay_plans` - Compensation plans
- `pay_plan_variants` - Plan variations
- `payment_settings` - Payment configurations
- `payment_settings_variants` - Setting variations
- `fees` - Fee structures
- `taxes` - Tax information
- `w9` - W9 tax forms
- `w9_addresses` - W9 address associations

#### External Integration
- `external_references` - External system IDs
- `agent_external_references` - Agent external refs
- `company_external_references` - Company external refs
- `office_external_references` - Office external refs

#### Profile & Communication
- `public_profiles` - Public agent profiles
- `contact_methods` - Contact information
- `email_forwards` - Email forwarding rules
- `socials` - Social media links

#### Metadata & Configuration
- `languages` - Language options
- `agent_languages` - Agent language associations
- `specialties` - Agent specialties
- `agent_specialties` - Agent specialty associations
- `mls` - MLS systems
- `agent_mls` - Agent MLS associations
- `line_of_business` - Business lines
- `programs` - Programs
- `state_programs` - State-specific programs
- `sponsor_configurations` - Sponsor settings
- `custom_flags` - Custom flags
- `artifacts` - Document artifacts
- `notes` - Notes and comments
- `relationships` - Agent relationships
- `organization_contacts` - Org contacts

### Migration Strategy

**TypeORM Migrations:**
- Migrations stored in `packages/database/src/migrations/`
- Run from service context: `pnpm migration:run`
- Never use `synchronize: true` in production

**Commands:**
```bash
# Generate migration
pnpm migration:generate --name=AddAgentField

# Run migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert

# Show migration status
pnpm migration:show
```

---

## Domain Model

### Core Domain Entities

#### Agent
```typescript
{
  id: UUID
  firstName: string (2-50 chars)
  lastName: string (2-50 chars)
  preferredName?: string
  suffix?: 'Jr' | 'Sr' | 'II' | 'III' | ...
  email: string (validated)
  birthDate: ISO date
  lifecycleStatus?: 'Joining' | 'Active' | 'Inactive' | ...
  agentCompanyId: UUID
  
  // Relations (expanded)
  agentCompany?: AgentCompany
  addresses?: AgentAddress[]
  licenses?: License[]
  artifacts?: Artifact[]
}
```

#### Company
```typescript
{
  id: UUID
  name: string
  email: string (validated)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Relations (expanded)
  externalReferences?: ExternalReference[]
}
```

#### Office
```typescript
{
  id: UUID
  officeId: bigint (legacy)
  name: string
  phone: string
  website?: URL
  lifecycleStatus: 'new' | 'pending' | 'active' | ...
  primaryState: string
  
  // Relations (expanded)
  agentOffices?: AgentOffice[]
  officeExternalReferences?: OfficeExternalReference[]
}
```

### Value Objects

**Branded Types** (runtime validation):
- `NameBranded` - 2-50 chars, trimmed
- `EmailBranded` - Valid email format
- `PhoneNumberBranded` - E.164 format
- `PostalCodeBranded` - Country-specific validation
- `UrlBranded` - Valid URL
- `DateOnlyISO` - YYYY-MM-DD format
- `InstantUTC` - ISO 8601 timestamp

### Enums

```typescript
enum CountryCode { US = 'US', CA = 'CA' }

enum AgentLifecycleStatus {
  Joining = 'Joining',
  Active = 'Active',
  Inactive = 'Inactive',
  Vested = 'Vested',
  VestedRetired = 'Vested Retired',
  LeadOnly = 'Lead Only',
}

enum OfficeLifecycleStatus {
  New = 'new',
  Pending = 'pending',
  DueDiligence = 'due_diligence',
  PendingPayment = 'pending_payment',
  Active = 'active',
  Withdrawn = 'withdrawn',
  MissingBrokerAgent = 'missing_broker_agent',
}
```

---

## Infrastructure

### Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: agent_database
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: pg_isready

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redisdata:/data]
    command: redis-server --appendonly yes
    healthcheck: redis-cli ping

  agent-service:
    build: ./services/agent-service
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    env_file: [.env, ./services/agent-service/.env.agentservice]

  agent-orchestrator:
    build: ./services/orchestrator
    ports: ["3001:8081"]
    depends_on: [agent-service]
    env_file: [.env, ./services/orchestrator/.env.orchestrator]
```

### Environment Variables

**Database:**
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USERNAME` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `DB_NAME` - Database name (default: agent_database)

**Redis:**
- `REDIS_URL` - Redis connection URL
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_TLS` - Enable TLS (default: false)

**Application:**
- `NODE_ENV` - Environment (development|test|production)
- `LOG_LEVEL` - Log level (debug|info|warn|error)
- `LOG_DIR` - Log directory (default: ./logs)
- `PORT` - Service port

---

## Key Design Decisions

### ADR-001: Database Entity Separation

**Decision:** Separate domain schemas (Zod) from database entities (TypeORM)

**Rationale:**
- Single responsibility principle
- Domain portability (no ORM coupling)
- Clean API documentation
- Type safety via `z.infer<typeof Schema>`

**Impact:**
- ✅ Clear separation of concerns
- ✅ Flexible for future changes
- ⚠️ More boilerplate (mitigated by `implements`)

### ADR-002: Base/Expanded Schema Pattern

**Decision:** Dual schema variants for performance optimization

**Rationale:**
- List views don't need relationships (10-30x faster)
- Detail views need full object graphs (avoid N+1)
- Explicit control over data loading

**Impact:**
- ✅ Significant performance gains
- ✅ Clear intent in code
- ⚠️ More schema definitions

### Monorepo with PNPM Workspaces

**Decision:** Single repository with workspace protocol

**Rationale:**
- Shared dependencies and tooling
- Atomic cross-package changes
- Simplified CI/CD
- Better code reuse

**Impact:**
- ✅ Easier refactoring
- ✅ Consistent tooling
- ⚠️ Larger repository size

### NestJS Framework

**Decision:** Use NestJS for all services

**Rationale:**
- Mature TypeScript framework
- Built-in DI container
- Excellent TypeORM integration
- Microservices support
- Strong community

**Impact:**
- ✅ Rapid development
- ✅ Consistent patterns
- ⚠️ Framework lock-in

---

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker-compose up postgres redis

# Run migrations
cd services/agent-service
pnpm migration:run

# Start services
pnpm dev  # All services in watch mode
```

### Testing

```bash
# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:coverage
```

### Building

```bash
# Build all packages
pnpm build:packages

# Build all services
pnpm build:services

# Build everything
pnpm build
```

### Linting & Formatting

```bash
# Lint
pnpm lint

# Fix linting issues
pnpm lint:fix

# Check package.json consistency
pnpm sync:check
pnpm sync:fix
```

---

## Future Roadmap

### Planned Features

1. **Event-Driven Architecture**
   - Kafka integration
   - Event sourcing for audit trails
   - CQRS pattern for read/write separation

2. **API Implementation**
   - Complete CRUD for all entities
   - GraphQL API (optional)
   - Batch operations
   - Search and filtering

3. **Authentication & Authorization**
   - JWT-based auth
   - Role-based access control (RBAC)
   - Multi-tenancy support

4. **Observability**
   - OpenTelemetry tracing
   - Prometheus metrics
   - Grafana dashboards
   - Structured logging

5. **Testing**
   - Comprehensive unit tests
   - Integration tests
   - Contract testing
   - Load testing

---

## References

- [ADR-001: Database Entity Separation](./docs/ADRs/001-database-entity-separation.md)
- [ADR-002: Base/Expanded Schema Pattern](./docs/ADRs/002-base-expanded-schema-pattern.md)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Zod Documentation](https://zod.dev/)

---

**Document Version:** 1.0  
**Last Updated:** October 29, 2025  
**Maintained By:** Architecture Team