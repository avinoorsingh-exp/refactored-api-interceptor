# ADR-001: Separation of Domain Schemas and Database Entities

## Status

**Accepted** - October 21, 2025

## Context

We are building a monorepo for the eXpRealty platform with:

- **Domain-first design** using Zod schemas in `@exprealty/shared-domain`
- **TypeORM** for database persistence with PostgreSQL
- **NestJS** services that consume both domain contracts and database entities

We need to decide how to structure our domain models and database entities to:

1. Maintain clean separation of concerns
2. Ensure a single source of truth for domain contracts
3. Enable API Extractor compliance with proper TSDoc release tags
4. Support TypeORM migrations and database schema evolution
5. Prevent tight coupling between domain validation and persistence layers

## Decision

We will **separate domain schemas from database entities** using the following architecture:

### Package Structure

```
packages/
  ├── shared-domain/          # Pure domain layer (Zod schemas)
  │   ├── src/
  │   │   ├── value-objects/  # Branded types, validation rules
  │   │   ├── entities/       # Domain entity schemas (Zod)
  │   │   └── index.ts        # Public API with @public tags
  │   └── package.json
  │
  └── database/               # Persistence layer (TypeORM)
      ├── src/
      │   ├── entities/       # TypeORM entity classes
      │   ├── migrations/     # TypeORM migrations
      │   ├── data-source.ts  # TypeORM DataSource config
      │   └── index.ts        # Public API with @public/@internal tags
      └── package.json        # Depends on @exprealty/shared-domain
```

### Principles

#### 1. **Domain Schemas (`@exprealty/shared-domain`)**

- **Purpose**: Define canonical domain contracts, validation rules, and business invariants
- **Technology**: Zod schemas only
- **Exports**: All marked with `@public` or `@internal` TSDoc tags
- **Rules**:
  - NO TypeORM decorators
  - NO database-specific concerns (indexes, column types, etc.)
  - One canonical schema per domain concept
  - Services use `z.infer<typeof Schema>` for TypeScript types

**Example:**

```typescript
/**
 * Zod schema for a persisted agent entity.
 * @public
 */
export const AgentSchema = z.strictObject({
	id: z.string().uuid(),
	firstName: NameBranded,
	email: EmailBranded,
	// ... domain fields only
})

/**
 * TypeScript type for a persisted agent.
 * @public
 */
export type Agent = z.infer<typeof AgentSchema>
```

#### 2. **Database Entities (`@exprealty/database`)**

- **Purpose**: Map domain types to database tables, handle persistence concerns
- **Technology**: TypeORM entity classes
- **Type Safety**: Use `z.infer<typeof Schema>` from shared-domain
- **Exports**: All marked with `@public` or `@internal` TSDoc tags
- **Rules**:
  - Import and use types from `@exprealty/shared-domain`
  - Add TypeORM decorators (`@Entity`, `@Column`, `@ManyToOne`, etc.)
  - Define database-specific concerns (indexes, constraints, column types)
  - Migrations live here

**Example:**

```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { Agent as DomainAgent } from '@exprealty/shared-domain'

/**
 * TypeORM entity for Agent table.
 * Implements domain Agent type with database mapping.
 * @public
 */
@Entity('agents')
export class AgentEntity implements Omit<DomainAgent, 'createdAt' | 'updatedAt'> {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'first_name', type: 'varchar', length: 50 })
	firstName!: string

	@Column({ type: 'varchar', length: 255, unique: true })
	email!: string

	@Column({ name: 'agent_company_id', type: 'uuid' })
	agentCompanyId!: string

	@ManyToOne(() => AgentCompanyEntity)
	@JoinColumn({ name: 'agent_company_id' })
	agentCompany?: AgentCompanyEntity

	@Column({
		name: 'created_at',
		type: 'timestamp with time zone',
		default: () => 'CURRENT_TIMESTAMP',
	})
	createdAt!: Date

	@Column({
		name: 'updated_at',
		type: 'timestamp with time zone',
		default: () => 'CURRENT_TIMESTAMP',
	})
	updatedAt!: Date
}
```

#### 3. **Service Layer Usage**

Services import from BOTH packages based on context:

```typescript
// In NestJS controllers/services
import { AgentSchema, CreateAgentInput, type Agent } from '@exprealty/shared-domain'
import { AgentEntity } from '@exprealty/database'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

@Injectable()
export class AgentService {
	constructor(
		@InjectRepository(AgentEntity)
		private agentRepo: Repository<AgentEntity>,
	) {}

	async create(input: unknown): Promise<Agent> {
		// 1. Validate with Zod schema
		const validated = CreateAgentInput.parse(input)

		// 2. Map to TypeORM entity
		const entity = this.agentRepo.create(validated)

		// 3. Save
		const saved = await this.agentRepo.save(entity)

		// 4. Return as domain type
		return AgentSchema.parse(saved)
	}
}
```

### Migration Strategy

1. **TypeORM CLI runs from service** (e.g., `services/agent-service`)
2. **Migrations reference** `packages/database/src/data-source.ts`
3. **Entities live in** `packages/database/src/entities/`
4. **Monorepo paths** resolved via TypeScript path mapping and PNPM workspace

**package.json scripts (in service):**

```json
{
	"scripts": {
		"typeorm": "typeorm-ts-node-esm -d ../../packages/database/src/data-source.ts",
		"migration:generate": "npm run typeorm -- migration:generate",
		"migration:run": "npm run typeorm -- migration:run",
		"migration:revert": "npm run typeorm -- migration:revert"
	}
}
```

## Rationale

### Why Separate?

1. **Single Responsibility**
   - Domain schemas: validation, business rules, API contracts
   - Database entities: persistence, queries, migrations

2. **API Extractor Compliance**
   - Pure Zod schemas are easier to document with TSDoc
   - No decorator noise in domain layer
   - Clean type exports for consumers

3. **Flexibility**
   - Can change database tech without touching domain
   - Domain can be used in browser/edge without TypeORM
   - Different services can use different ORMs if needed

4. **Type Safety**
   - TypeORM entities implement domain types via `z.infer<typeof Schema>`
   - Compiler catches mismatches between domain and persistence
   - Single source of truth for field names and types

5. **Migration Independence**
   - Database schema can evolve (add indexes, change column types)
   - Without affecting domain contracts
   - Breaking changes require updating both layers explicitly

### Why NOT Inline TypeORM Decorators?

❌ **Anti-pattern we're avoiding:**

```typescript
// DON'T mix Zod and TypeORM in shared-domain
export const AgentSchema = z.object({
	/* ... */
})

@Entity('agents') // ❌ Persistence concern in domain layer
export class Agent {
	@Column() // ❌ Database details leak into domain
	firstName!: string
}
```

Problems:

- Violates single responsibility
- Couples domain to TypeORM (vendor lock-in)
- Bloats shared-domain bundle with unnecessary deps
- Makes API documentation confusing
- Hard to use domain in non-database contexts

## Consequences

### Positive

✅ Clear separation of concerns
✅ Domain layer stays pure and portable
✅ Easy to document and maintain
✅ Type-safe mapping between layers
✅ Flexible for future changes

### Negative

⚠️ More boilerplate (two representations of each entity)
⚠️ Need to keep domain types and entities in sync manually
⚠️ Mapping logic required in services

### Mitigation

- Use `implements` to ensure entities match domain types
- Write tests to verify schema-entity compatibility
- Consider code generation if boilerplate becomes excessive

## Compliance with Shared Domain Principles

This ADR fully complies with the Shared Domain Implementation Guide:

- ✅ **Domain-first**: All domain logic stays in `shared-domain`
- ✅ **One canonical schema**: Zod schemas are single source of truth
- ✅ **Release tags**: Both packages use `@public`/`@internal` TSDoc
- ✅ **No vendor fields**: Database details isolated in `database` package
- ✅ **Inference only**: Services use `z.infer<typeof Schema>`
- ✅ **API Extractor compliance**: Clean, documented exports
- ✅ **Non-breaking changes**: Domain and DB can evolve independently

## Alternatives Considered

### Alternative 1: Inline TypeORM Decorators

**Rejected** - Violates separation of concerns, couples domain to persistence layer

### Alternative 2: Code Generation

**Deferred** - Could generate TypeORM entities from Zod schemas, but adds tooling complexity. Revisit if manual mapping becomes too burdensome.

### Alternative 3: Repository Pattern Without TypeORM Entities

**Rejected** - Loses type safety and migration capabilities of TypeORM

## References

- [Shared Domain Implementation Guide](../agent-service/packages/shared-domain/docs/prompt/shared-domain.md)
- [TypeORM Documentation - Separating Entity Definition](https://typeorm.io/separating-entity-definition)
- [Domain-Driven Design: Entity Pattern](https://martinfowler.com/bliki/EvansClassification.html)

## Authors

- GitHub Copilot
- eXpRealty Platform Team

---

**Next Steps:**

1. Create `packages/database` package structure
2. Implement TypeORM entities using `z.infer` from shared-domain
3. Set up DataSource and migration configuration
4. Add migration scripts to service package.json
5. Generate initial migration for Agent domain
