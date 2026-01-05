# Agent Service - AI Context Anchor

This document is the canonical **rehydration anchor** for AI tools (Claude Code, Cursor, Kiro) and humans.

If an AI session restarts, this file defines:
- where the system is
- what is completed
- what must not be changed
- what phase is active
- what files are safe to modify

**This file overrides chat history.**

---

## Current Phase

**Stabilization - Testing & Bug Fixes**

---

## Completed Phases

- Initial schema design and entity creation
- Agent, Company, Office, Address, and related entities
- Many-to-many relationships (AgentOffice, AgentAddress, AgentMLS)
- Query system with search, filter, sort, and projection
- Error handling with RFC 9457 Problem Details
- Migration workflow with idempotent migrations

---

## Stabilization Rules

During stabilization phase:
- No new features without explicit approval
- Minimal diffs preferred
- Update runbooks when changing runtime behavior
- Keep CI policy checks green
- Fix bugs and align docs before adding scope

---

## Core Invariants (DO NOT VIOLATE)

### Database
- **NEVER** use `synchronize: true` - Always use migrations
- **NEVER** use bigint for new foreign keys referencing agent - Use UUID referencing `agent.id`
- **ALWAYS** make migrations idempotent (check state before modifying)
- **ALWAYS** implement `down()` for migration rollback

### API
- **ALWAYS** use `ZodValidationPipe` for request body validation
- **ALWAYS** include `i18nType` in exceptions for localization
- **ALWAYS** use `PaginationInterceptor` for list endpoints
- **NEVER** expose stack traces in production responses

### Architecture
- Services depend on PORT interfaces (not concrete repositories)
- Repositories implement ports (adapters pattern)
- Entity → Domain mapping happens in repository adapter
- Domain types are pure, no framework dependencies

### Relationships
- Use string names for entity references (avoid circular imports)
- Always define FK column separately from relationship
- Specify `onDelete` behavior explicitly

---

## Local Runtime Topology

```
┌─────────────────────────────────────────────────────────────┐
│ orchestrator (port 8081)                                     │
│   - API Gateway / BFF                                        │
│   - Routes to agent-service                                  │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ agent-service (port 3000)                                    │
│   - Agent domain service                                     │
│   - CRUD operations                                          │
│   - Query/Projection system                                  │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL (port 5432)                                       │
│   - Database: agent_database                                 │
│   - Schema: core                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Verification Commands

```bash
# Build packages
pnpm build:packages

# Run unit tests
pnpm test:unit

# Start development server
pnpm dev

# Run migrations
cd packages/database && pnpm migration:run

# Check migration status
cd packages/database && pnpm migration:show

# Lint and format
pnpm lint && pnpm format
```

---

## Rehydration Instructions for AI Tools

When starting a new AI session:

### For ANY Task
1. Read this file (`docs/ai/context.md`)
2. Confirm the current phase before making changes
3. Check core invariants apply to your task

### For New Route/Endpoint
1. Read `docs/architecture/api-patterns.md`
2. Read `docs/runbooks/adding-new-route.md`
3. Read `.github/instructions/api-architect.instructions.md`
4. Follow the patterns in existing controllers

### For New Entity
1. Read `docs/architecture/entity-patterns.md`
2. Read `docs/runbooks/creating-new-entity.md`
3. Read `packages/database/.github/instructions/entity-design.instructions.md`
4. Read `packages/database/.github/instructions/foreign-key-consistency.instructions.md`

### For Database Migration
1. Read `docs/runbooks/migration-workflow.md`
2. Read `packages/database/.github/instructions/migration-design.instructions.md`
3. Read `packages/database/.github/instructions/data-source-config.instructions.md`
4. **NEVER** use `synchronize: true`

### For Bug Fix
1. Read `docs/runbooks/bug-fix-workflow.md`
2. Read `docs/architecture/error-handling.md`
3. Reproduce the issue first
4. Add test for the specific case
5. Minimal diff preferred

### For New Module
1. Read `docs/runbooks/creating-new-module.md`
2. Read `docs/architecture/repository-patterns.md`
3. Follow the module structure pattern

### For Query/Search Issues
1. Read `docs/architecture/query-system.md`
2. Read `.github/instructions/query-specialist.instructions.md`
3. Check entity decorators (@Searchable, @Filterable, @Sortable)

---

## Key Files Reference

### Instructions (Read Before Coding)
- `.github/instructions/api-architect.instructions.md` - Controller patterns
- `.github/instructions/entity-architect.instructions.md` - Entity design
- `.github/instructions/repository-engineer.instructions.md` - Repository patterns
- `.github/instructions/query-specialist.instructions.md` - Query system
- `.github/instructions/error-handling.instructions.md` - Exception handling
- `packages/database/.github/instructions/entity-design.instructions.md` - Entity details
- `packages/database/.github/instructions/migration-design.instructions.md` - Migration patterns
- `packages/database/.github/instructions/foreign-key-consistency.instructions.md` - FK rules

### Architecture Docs
- `docs/architecture/api-patterns.md` - HTTP layer patterns
- `docs/architecture/query-system.md` - QueryService, ProjectionService
- `docs/architecture/entity-patterns.md` - TypeORM entity design
- `docs/architecture/repository-patterns.md` - Ports and adapters
- `docs/architecture/error-handling.md` - Exception handling

### Runbooks (Step-by-Step)
- `docs/runbooks/adding-new-route.md` - Add endpoint to module
- `docs/runbooks/creating-new-entity.md` - Create database entity
- `docs/runbooks/creating-new-module.md` - Full module creation
- `docs/runbooks/migration-workflow.md` - Database migrations
- `docs/runbooks/bug-fix-workflow.md` - Bug diagnosis and fix

### Existing Architecture Docs
- `docs/ARCHITECTURE-OVERVIEW.md` - System overview
- `docs/DDD-ARCHITECTURE.md` - Domain-driven design patterns
- `docs/BASE-REPOSITORY-GUIDE.md` - Repository implementation
- `docs/QUERY-SERVICE.md` - Query system reference

---

## Common Patterns Quick Reference

### Controller Endpoint
```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create resource' })
async create(
  @Body(new ZodValidationPipe(CreateSchema, 'resource.validation'))
  dto: CreateDto,
  @Res({ passthrough: true }) res: Response,
): Promise<ResponseDto> {
  const entity = await this.service.create(dto);
  res.setHeader('Location', `/v1/resources/${entity.id}`);
  return entity;
}
```

### Entity FK Pattern
```typescript
@Column({ name: 'agent_id', type: 'uuid' })
agentId!: string;

@ManyToOne(() => AgentEntity)
@JoinColumn({ name: 'agent_id' })
agent?: AgentEntity;
```

### Port/Adapter Pattern
```typescript
// Service depends on interface
constructor(
  @Inject('IResourceRepository')
  private readonly repository: IResourceRepository,
) {}
```

### Idempotent Migration
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  const exists = await queryRunner.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'table' AND column_name = 'column'
  `);
  if (exists.length > 0) return;
  // ... migration logic
}
```

---

**This file overrides chat history.**
