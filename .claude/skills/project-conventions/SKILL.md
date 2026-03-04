---
name: project-conventions
description: eXpRealty platform conventions, specialist agent scopes, architectural patterns, and file ownership map. Loaded by project-agnostic agents (code-reviewer, etc.) to make them aware of this project's rules and boundaries.
---

# eXpRealty Platform Conventions

## Current Phase: Stabilization

Stabilization rules:
- Bug fixes, missing tests, docs updates, and decorator fixes are always permitted
- New endpoints, new entities, new modules require explicit named approval
- Sealed decisions (response shapes, core invariants) cannot be changed
- No speculative scaffolding

---

## Specialist Agents & File Ownership

When reviewing code, map changed files to the owning specialist:

| File Path Pattern | Owner | Key Constraints |
|---|---|---|
| `packages/shared-domain/src/schemas/` | @domain-schema-expert | Base/Expanded pattern, AuditableSchema merge, pure TS+Zod only, no framework imports |
| `packages/shared-domain/src/value-objects/` | @domain-schema-expert | Branded types with validation |
| `packages/shared-domain/src/index.ts` | @domain-schema-expert | Must export everything — if it's not here, it's not usable |
| `packages/database/src/entities/core/` | @entity-architect | Extends AuditableEntity, UUID PK, FK column separate from relation, eager: false, query decorators required |
| `packages/database/src/entities/index.ts` | @entity-architect | Barrel export — new entities must be added here |
| `packages/database/src/decorators/` | @entity-architect / @metadata-introspection-expert | @Searchable, @Filterable, @Sortable definitions |
| `packages/database/src/migrations/` | @database-architect | Idempotent, working down(), never modify applied migrations, CREATE INDEX CONCURRENTLY |
| `packages/database/src/data-source.ts` | @database-architect | synchronize: false is non-negotiable |
| `services/agent-service/src/modules/*/ports/` | @repository-engineer | Port interfaces + Symbol tokens |
| `services/agent-service/src/modules/*/*.repository.ts` | @repository-engineer | Extends BaseTypeOrmRepository, spread in mapToDomain, no cross-aggregate injection |
| `services/agent-service/src/modules/*/config/` | @repository-engineer | Projection configs |
| `services/agent-service/src/modules/*/*.controller.ts` | @api-layer-architect | Thin, ZodValidationPipe, PaginationInterceptor on lists, POST→201, DELETE→204 |
| `services/agent-service/src/modules/*/dto/` | @api-layer-architect | createZodDto wrapping domain schemas |
| `services/agent-service/src/common/filters/` | @error-handling-specialist | ProblemDetailsFilter, RFC 9457 |
| `services/agent-service/src/common/exceptions/` | @error-handling-specialist | Custom exceptions with i18nType |
| `services/agent-service/src/common/pipes/` | @error-handling-specialist | ZodValidationPipe |
| `services/agent-service/src/common/query/` | @query-system-specialist | QueryService, ProjectionService, search strategies |
| `services/agent-service/src/modules/metadata/` | @metadata-introspection-expert | Entity map registration, cached metadata responses |
| `services/orchestrator/` | @api-layer-architect | Gateway proxy controllers |
| `packages/*/package.json` | @monorepo-navigator | workspace:* protocol, build order, exports map |
| `pnpm-workspace.yaml` | @monorepo-navigator | Workspace package globs |
| `tsconfig*.json` | @monorepo-navigator | Path aliases aligned with package entry points |
| `*.spec.ts` / `*.property.spec.ts` | @test-engineer | AAA pattern, boundary mocking, coverage floors |

If a file doesn't match any pattern above, flag it — it may be unowned or in the wrong location.

---

## Core Invariants (Never Violate)

These are sealed decisions. A PR that violates any of these is automatically **Critical**:

1. **synchronize: false** — all schema changes go through migrations
2. **AuditableEntity / AuditableSchema** — every entity extends it, every schema merges it
3. **RFC 9457 Problem Details** — all error responses use `{ type, title, status, detail, instance }`
4. **i18nType on exceptions** — every custom exception carries a localization key
5. **core schema** — all tables live in `"core"."table_name"`
6. **UUID primary keys** — `@PrimaryGeneratedColumn('uuid')` everywhere
7. **No cross-aggregate repository injection** — use guards or service calls
8. **Base/Expanded schema pattern** — list view vs detail view separation
9. **Port-based DI** — repositories injected via interface Symbol, not concrete class
10. **PaginationInterceptor on all list endpoints** — returns `{ data, meta }` shape

---

## Naming Conventions

| Concept | Pattern | Example |
|---------|---------|---------|
| Entity class | Singular + `Entity` | `OfficeEntity` |
| Schema | Singular + `BaseSchema` / `ExpandedSchema` | `OfficeBaseSchema` |
| DB table | Singular, snake_case, `core` schema | `core.office` |
| Module class | Plural + `Module` | `OfficesModule` |
| Service class | Plural + `Service` | `OfficesService` |
| Controller class | Plural + `Controller` | `OfficesController` |
| Repository class | Plural + `TypeOrmRepository` | `OfficesTypeOrmRepository` |
| Port interface | `I` + Singular + `Repository` | `IOfficeRepository` |
| Port symbol | UPPER_SNAKE + `_REPOSITORY` | `OFFICE_REPOSITORY` |
| Route | Plural, kebab-case, `/v1/` prefix | `/v1/offices` |
| Module directory | Plural | `modules/offices/` |
| DTO files | Singular resource | `create-office.dto.ts` |
| Test files | Match source file + `.spec.ts` | `offices.service.spec.ts` |
| FK columns | `{referenced_table}_id` | `region_id` |
| FK constraints | `FK_{table}_{reference}` | `FK_office_region` |
| Indexes | `IDX_{table}_{column}` | `IDX_office_name` |
| Unique | `UQ_{table}_{column}` | `UQ_office_code` |

---

## Build Order (Monorepo)

Changes to upstream packages break downstream. Always verify in this order:

```
1. @exprealty/shared-domain     (no internal deps)
2. @exprealty/config            (no internal deps)
3. @exprealty/logger            (depends on shared-domain)
4. @exprealty/database          (depends on shared-domain, config)
5. @exprealty/cache             (depends on config)
6. services/*                   (depend on all packages above)
```

If a PR touches `shared-domain`, every downstream package is in the blast radius.

---

## Entity Relationship Rules

- FK column always defined separately from the `@ManyToOne` decorator
- All relations `eager: false` unless explicitly justified
- `onDelete` required on every `@ManyToOne`
- Use string names for entity references in decorators to avoid circular imports
- `@Column({ name: 'snake_case' })` when the TS property is camelCase

---

## Query System Rules

- Fields must have `@Searchable`, `@Filterable`, `@Sortable` decorators to be queryable — undecorated fields are rejected
- `@Searchable` weight range: 1-10 (10 = most relevant)
- UUID/BigInt/Date columns cast to `::text` for ILIKE — never cast for numeric operators
- Virtual relations: mark `virtual: true` in ProjectionConfig, load via `leftJoinAndMapOne`
- Sort input arrives as both array and object format — handle both

---

## Pagination Performance Rules

These rules prevent COUNT query inflation in `getManyAndCount()`, which scans the full table
with all LEFT JOINs included. Violations are **High** severity.

### When to POST-LOAD (by IDs after pagination)

- **1:N relations with unbounded cardinality** — e.g., contactMethods (0-50 per agent),
  addresses, notes, external references. A LEFT JOIN multiplies rows, and the COUNT
  re-scans the full joined result set.
- **Filtered 1:1 virtual relations requested via `?include=`** — e.g., primaryEmail,
  primaryPhone, primaryAddress. Even though `isPrimary=true` filters to 1 row, the JOIN
  is still present in the COUNT query which doesn't need it.
- Pattern: strip from includes, run pagination query clean, then
  `SELECT ... FROM table WHERE parent_id = ANY($1)` with the page's IDs (typically 25).

### When JOINs are acceptable in pagination

- **True 1:1 relations** — e.g., primaryLicense, primaryAgentCompany, primaryTax —
  where the relation has low total row count and adds at most 1 row per parent.
- **Relations required for ORDER BY** — e.g., sorting by primaryEmail.value. Use a
  lightweight `leftJoin` (not `leftJoinAndSelect`) for the sort column only. This JOIN
  will appear in the COUNT but is unavoidable for correct sorting.
- **Relations required for WHERE** — e.g., filtering by email, country. Use EXISTS
  subqueries where possible to avoid the JOIN entirely.

### EXPLAIN ANALYZE safety

- `PERF_QUERY_CAPTURE_EXPLAIN` must default to `off`. EXPLAIN ANALYZE **re-executes
  the query**, doubling response time. A 3s slow query + 3s EXPLAIN = 6s+ → gateway timeout.
- Only enable temporarily for diagnostics, then set back to `off`.
- Defaults are defined in the Zod schema (`services/agent-service/src/core/configuration.ts`),
  NOT in `main.ts` fallbacks.

### Code review flags (auto-Critical/High)

- `leftJoinAndSelect` or `leftJoinAndMapOne` on a 1:N relation inside `findPage()` → **High**
- `contactMethods`, `addresses`, `notes`, `externalReferences` joined in pagination → **High**
- `PERF_QUERY_CAPTURE_EXPLAIN` defaulting to `slow` or `all` → **Critical**
- Post-query loader missing `if (items.length === 0) return result` guard → **Medium**
- `mapToDomain` setting a field that a post-query helper will overwrite → **Low** (tech debt)

---

## Error Handling Rules

- Database error code mapping:
  - `23505` → 409 Conflict
  - `23503` → 400 Bad Request (FK violation)
  - `23502` → 400 Bad Request (not null violation)
  - `QueryFailedError` → 400
  - `TypeORMError` → 500
- Validation errors include field-level detail array
- 4xx logged at WARN, 5xx logged at ERROR, both include correlation ID
- No stack traces in production responses

---

## Test Conventions

- Coverage floors: Service 90/90/80, Repository 85/85/75, Interceptors/Filters 80/80/70
- Entities, modules, migrations, DTOs excluded from coverage
- Mock at boundaries: repositories in service tests, service in controller tests
- Property-based tests (fast-check) for query parameter edge cases
- Mock factories in `services/test/`: `createMock{Resource}Repository()`
- Test behavior, not implementation — don't test private methods

---

## Documentation Locations

| Doc | What it covers |
|-----|----------------|
| `docs/architecture/api-patterns.md` | Controller conventions, response shapes |
| `docs/architecture/entity-patterns.md` | Entity decorators, relationship rules |
| `docs/architecture/repository-patterns.md` | BaseTypeOrmRepository, mapToDomain, ports |
| `docs/architecture/query-system.md` | QueryService, search strategies, filter operators |
| `docs/architecture/error-handling.md` | ProblemDetailsFilter, exception classes |
| `docs/runbooks/creating-new-module.md` | Full module creation procedure (12 steps) |
| `docs/runbooks/creating-new-entity.md` | Entity + migration procedure |
| `docs/runbooks/adding-new-route.md` | Route addition procedure |
| `docs/runbooks/migration-workflow.md` | Migration creation and rollback |
| `docs/runbooks/adding-virtual-relation-sorting-filtering.md` | Virtual relation query patterns |