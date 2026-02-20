---
name: new-module
description: Scaffold a complete NestJS module from domain schema through tested endpoint. Use when creating a new resource module, adding an entity with full controller/service/repository stack, or when the user says "new module", "new route", "add endpoint", "create entity", or "wire up a resource". Follows the 12-step runbook in docs/runbooks/creating-new-module.md.
---

# New Module — Full Stack Scaffold

Orchestrates the creation of a complete NestJS module by delegating to specialist agents in dependency order. Each phase has a gate that must pass before proceeding.

**Runbook reference:** `docs/runbooks/creating-new-module.md`

---

## Inputs

Collect before starting — do not proceed with missing inputs:

- **Resource name** (singular): e.g., `office`, `transaction`, `listing`
- **Domain concept**: one-line description of what this entity represents
- **Fields**: column names, types, nullability, defaults, constraints
- **Relations**: FKs to existing entities (type, target, cascade, onDelete)
- **Queryable fields**: which fields need `@Searchable`, `@Filterable`, `@Sortable`
- **Route prefix**: e.g., `/v1/offices`
- **Phase approval**: confirm this module is approved for the current phase

If current phase is **Stabilization**, require explicit named approval before proceeding. Do not generate speculative scaffolding.

---

## Phase 1 — Domain Schema

**Delegate to: @domain-schema-expert**

Create the Zod schemas in `packages/shared-domain/src/schemas/{resource}.ts`:

```
{Resource}BaseSchema          — list view: scalars + AuditableSchema merge
{Resource}ExpandedSchema      — detail view: Base + z.lazy() relations
Create{Resource}InputSchema   — Base.omit({ id, created, lastModified, modifiedBy })
Update{Resource}InputSchema   — Create.partial()
```

Type exports:
```
{Resource}Base, {Resource}Expanded, {Resource} (= Expanded),
Create{Resource}Input, Update{Resource}Input
```

Export all from `packages/shared-domain/src/index.ts`.

**Gate**: Schema compiles. Types are exported. `pnpm build:packages` passes for `@exprealty/shared-domain`.

---

## Phase 2 — TypeORM Entity

**Delegate to: @entity-architect**

Create `packages/database/src/entities/core/{resource}.entity.ts`:

- Extends `AuditableEntity`
- `@Entity({ name: '{table_name}', schema: 'core' })`
- `@PrimaryGeneratedColumn('uuid')`
- FK columns defined separately from `@ManyToOne` decorators
- All relations `eager: false` with explicit `onDelete`
- `@Searchable`, `@Filterable`, `@Sortable` applied to every queryable field
- Column `name:` uses snake_case when property is camelCase

Export from:
- `packages/database/src/entities/index.ts`
- `packages/database/src/index.ts`

**Gate**: Entity compiles. Field names and types align exactly with Phase 1 schema. `pnpm build:packages` passes for `@exprealty/database`.

---

## Phase 3 — Migration

**Delegate to: @database-architect**

Create `packages/database/src/migrations/{timestamp}_Create{Resource}.ts`:

- Table in `core` schema
- Idempotent: check existence before CREATE/ALTER/DROP
- Working `down()` method that fully reverses `up()`
- `CREATE INDEX CONCURRENTLY` for indexed columns
- UUID PKs via `uuid_generate_v4()`
- FK naming: `FK_{table}_{reference}`
- Index naming: `IDX_{table}_{column}`

**Gate**: Migration runs cleanly against local database. `down()` reverses without errors. Entity and migration are in sync.

---

## Phase 4 — Repository Layer

**Delegate to: @repository-engineer**

Create three files in `services/agent-service/src/modules/{resources}/`:

```
ports/{resources}.repository.port.ts     — IXxxRepository + XXX_REPOSITORY symbol
{resources}.repository.ts                — extends BaseTypeOrmRepository
config/{resource}-projection.config.ts   — field projection + relation loading
```

Repository must implement:
- `getEntityClass()`, `getQueryConfig()`, `getAlias()`
- `mapToDomain()` using spread (override only transforms)
- `mapToEntity()` for persistence
- Port symbol: `export const XXX_REPOSITORY = Symbol('XXX_REPOSITORY')`

Projection config must declare:
- Base fields (list view)
- Expanded fields (detail view with relations)
- Virtual relations if needed (mark `virtual: true`, loaded via `leftJoinAndMapOne`)

**Gate**: Repository compiles. Port interface matches domain type from Phase 1. `pnpm build` passes.

---

## Phase 5 — Controller, DTOs, Module Wiring

**Delegate to: @api-layer-architect**

Create module directory `services/agent-service/src/modules/{resources}/`:

```
dto/
├── create-{resource}.dto.ts        — createZodDto(Create{Resource}InputSchema)
├── update-{resource}.dto.ts        — createZodDto(Update{Resource}InputSchema)
├── {resource}-response.dto.ts      — z.infer<typeof {Resource}BaseSchema>
└── {resource}-id-param.dto.ts      — z.object({ id: z.string().uuid() })

{resources}.controller.ts           — thin, delegates to service
{resources}.service.ts              — business logic, injects via port symbol
{resources}.module.ts               — wires providers, imports, exports
```

Controller constraints:
- `@ApiTags('{resources}')`, all routes prefixed `/v1/`
- `@UseInterceptors(PaginationInterceptor)` on list endpoint
- `@UseGuards(AgentExistsGuard)` if this is a nested resource
- `ZodValidationPipe` for all request bodies and path params
- POST → 201 + Location header, DELETE → 204
- No try/catch — `ProblemDetailsFilter` handles exceptions
- All exceptions include `i18nType`
- `@ApiOperation` + `@ApiResponse` on every endpoint

Register module in `services/agent-service/src/app.module.ts`.

**Gate**: `pnpm build` succeeds. Swagger UI shows all new endpoints at `/api`. No circular dependency warnings.

---

## Phase 6 — Metadata Registration

**Delegate to: @metadata-introspection-expert**

Register entity in `MetadataService` entity map:

```typescript
private readonly entityMap: Map<string, new () => any> = new Map([
  // ... existing entries
  ['{resources}', {Resource}Entity],
]);
```

Verify:
- `GET /v1/{resources}/metadata` returns searchable, filterable, sortable fields
- Fields sorted by weight descending
- Both kebab-case and snake_case lookups resolve

**Gate**: Metadata endpoint returns correct field inventory for the new entity.

---

## Phase 7 — Tests

**Delegate to: @test-engineer**

Create test files:

```
{resources}.service.spec.ts          — mock repository, test all service methods
{resources}.controller.spec.ts       — mock service, test HTTP behavior
{resources}.repository.spec.ts       — test mapToDomain edge cases
dto/{resource}-dto.validation.spec.ts — test Zod schema validation
{resources}.property.spec.ts         — fast-check property tests for query params
```

Required coverage:

| File | Lines | Functions | Branches |
|------|-------|-----------|----------|
| Service | ≥90% | ≥90% | ≥80% |
| Repository (custom methods) | ≥85% | ≥85% | ≥75% |
| Controller | ≥80% | ≥80% | ≥70% |

Test cases per method:

| Method | Happy | Not Found | Validation | Edge |
|--------|-------|-----------|------------|------|
| create | ✅ | — | ✅ bad DTO | ✅ duplicate (23505) |
| findAll | ✅ | — | — | ✅ empty list, pagination bounds |
| findOne | ✅ | ✅ 404 | — | — |
| update | ✅ | ✅ 404 | ✅ bad DTO | ✅ partial update |
| delete | ✅ | ✅ 404 | — | — |

Mock factory: add `createMock{Resource}Repository()` to `services/test/`.

**Gate**: `pnpm test:unit` passes. Coverage meets thresholds. No skipped tests.

---

## Phase 8 — Verification

**Back to main context** — no delegation.

Run the full verification sequence:

```bash
# 1. Packages build in order
pnpm build:packages

# 2. Service compiles
pnpm build

# 3. Lint passes
pnpm lint

# 4. All tests pass with coverage
pnpm test:unit --coverage

# 5. Workspace consistency
pnpm sync:check
```

Then verify manually:
- Swagger UI shows all new endpoints
- Metadata endpoint returns correct fields
- Smoke test: POST → GET → PATCH → GET → DELETE → GET (404)

Report to user:
- Complete file manifest (created + modified)
- Test results and coverage summary
- Any manual steps remaining (seed data, env vars, runbook updates)

---

## Cross-Agent Coordination Points

These are the handoff moments where two agents must be in sync:

| From | To | What must align |
|------|-----|-----------------|
| Domain Schema Expert | Entity Architect | Field names, types, nullability must match exactly |
| Entity Architect | Database Architect | Entity and migration must describe the same table |
| Domain Schema Expert | API Layer Architect | DTOs use `createZodDto()` wrapping the domain schemas |
| Entity Architect | Metadata Introspection Expert | `@Searchable`/`@Filterable`/`@Sortable` decorators drive metadata |
| Repository Engineer | API Layer Architect | Service injects via port symbol, not concrete class |
| All agents | Test Engineer | Test Engineer reads but does not modify source files |

If any misalignment is detected at a gate, stop and fix before proceeding.

---

## Rollback

If a phase fails unrecoverably:

1. List all files created and modified in this workflow
2. Revert modified files from git: `git checkout -- {file}`
3. Delete created files
4. If migration was applied: run `down()` to reverse it
5. Identify failure point for retry

---

## Naming Quick Reference

| Concept | Convention | Example |
|---------|-----------|---------|
| Entity class | Singular + `Entity` | `OfficeEntity` |
| Schema | Singular + `BaseSchema` / `ExpandedSchema` | `OfficeBaseSchema` |
| Table | Singular, snake_case, `core` schema | `core.office` |
| Module class | Plural + `Module` | `OfficesModule` |
| Service class | Plural + `Service` | `OfficesService` |
| Controller class | Plural + `Controller` | `OfficesController` |
| Repository class | Plural + `TypeOrmRepository` | `OfficesTypeOrmRepository` |
| Port interface | `I` + Singular + `Repository` | `IOfficeRepository` |
| Port symbol | UPPER_SNAKE + `_REPOSITORY` | `OFFICE_REPOSITORY` |
| Route | Plural, kebab-case | `/v1/offices` |
| Directory | Plural | `modules/offices/` |
| DTO files | Singular | `create-office.dto.ts` |
| Spec files | Match source file | `offices.service.spec.ts` |