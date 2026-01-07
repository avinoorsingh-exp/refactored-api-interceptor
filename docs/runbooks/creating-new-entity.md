# Runbook: Creating a New Entity

This runbook guides you through creating a new database entity with proper decorators, relationships, and migration.

## Prerequisites

Before starting:
1. Read `docs/architecture/entity-patterns.md`
2. Read `packages/database/.github/instructions/entity-design.instructions.md`
3. Read `packages/database/.github/instructions/foreign-key-consistency.instructions.md`

## Steps

### 1. Define Domain Schema

Create the domain schema in `@exprealty/shared-domain`:

```typescript
// packages/shared-domain/src/schemas/my-entity.ts
import { z } from 'zod';

export const MyEntityBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  agentId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const MyEntityExpandedSchema = MyEntityBaseSchema.extend({
  agent: z.lazy(() => AgentBaseSchema).optional(),
});

export type MyEntity = z.infer<typeof MyEntityExpandedSchema>;
export type MyEntityBase = z.infer<typeof MyEntityBaseSchema>;
```

### 2. Create TypeORM Entity

```typescript
// packages/database/src/entities/core/my-entity.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Searchable, Filterable, Sortable, SearchValidators } from '../decorators/searchable-decorators.js';
import type { AgentEntity } from './agent.entity.js';

/**
 * MyEntity represents a domain concept.
 * @public
 */
@Entity({ name: 'my_entity', schema: 'core' })
export class MyEntityEntity {
  /**
   * Unique identifier (UUID)
   * @public
   */
  @PrimaryGeneratedColumn('uuid')
  @Searchable({ weight: 3, behavior: 'exact', description: 'Unique identifier' })
  @Filterable()
  @Sortable()
  id!: string;

  /**
   * Entity name
   * @public
   */
  @Column({ name: 'name', type: 'text' })
  @Searchable({ weight: 10, behavior: 'partial', description: 'Entity name' })
  @Filterable()
  @Sortable()
  name!: string;

  /**
   * Optional description
   * @public
   */
  @Column({ name: 'description', type: 'text', nullable: true })
  @Searchable({ weight: 5, behavior: 'partial', description: 'Description' })
  description?: string;

  /**
   * Reference to owning agent (UUID)
   * @public
   */
  @Column({ name: 'agent_id', type: 'uuid' })
  @Searchable({ weight: 4, behavior: 'exact', description: 'Agent ID (UUID)' })
  @Filterable()
  @Sortable()
  agentId!: string;

  /**
   * Agent relationship
   */
  @ManyToOne('AgentEntity')
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity;

  /**
   * Creation timestamp
   * @public
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  @Searchable({ type: 'date', weight: 2, behavior: 'range', description: 'Creation date' })
  @Filterable()
  @Sortable()
  createdAt!: Date;

  /**
   * Last update timestamp
   * @public
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  @Searchable({ type: 'date', weight: 2, behavior: 'range', description: 'Last update date' })
  @Filterable()
  @Sortable()
  updatedAt!: Date;
}
```

### 3. Register Entity in DataSource

```typescript
// packages/database/src/data-source.ts
import { MyEntityEntity } from './entities/core/my-entity.entity.js';

export const AppDataSource = new DataSource({
  // ...
  entities: [
    // ... existing entities
    MyEntityEntity,
  ],
});
```

### 4. Export from Package

```typescript
// packages/database/src/index.ts
export { MyEntityEntity } from './entities/core/my-entity.entity.js';
```

### 5. Generate Migration

```bash
cd packages/database
pnpm migration:generate -- -n CreateMyEntityTable
```

### 6. Review and Enhance Migration

Edit the generated migration to be idempotent:

```typescript
// packages/database/src/migrations/TIMESTAMP-CreateMyEntityTable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the my_entity table for storing entity data.
 * This migration is idempotent - safe to run multiple times.
 */
export class CreateMyEntityTable1234567890123 implements MigrationInterface {
  name = 'CreateMyEntityTable1234567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'core' AND table_name = 'my_entity'
    `);

    if (tableExists.length > 0) {
      return;
    }

    // Create table
    await queryRunner.query(`
      CREATE TABLE "core"."my_entity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "description" text,
        "agent_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_my_entity" PRIMARY KEY ("id"),
        CONSTRAINT "FK_my_entity_agent" FOREIGN KEY ("agent_id")
          REFERENCES "core"."agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_my_entity_agent_id"
      ON "core"."my_entity" ("agent_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_my_entity_name"
      ON "core"."my_entity" ("name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."my_entity"`);
  }
}
```

### 7. Run Migration

```bash
cd packages/database
pnpm migration:run
```

### 8. Add Inverse Relationship (if needed)

If the parent entity needs to access children:

```typescript
// packages/database/src/entities/core/agent.entity.ts
@OneToMany('MyEntityEntity', 'agent')
myEntities?: MyEntityEntity[];
```

### 9. Build and Test

```bash
# Build database package
cd packages/database
pnpm build

# Run tests
pnpm test

# Test migration rollback
pnpm migration:revert
pnpm migration:run
```

## Checklist

### Entity Design
- [ ] Primary key is `uuid` (not bigint)
- [ ] Foreign keys use `uuid` type referencing parent's `id`
- [ ] Column names are snake_case
- [ ] Property names are camelCase
- [ ] `@Column({ name: '...' })` specified for multi-word properties
- [ ] `@Searchable` with appropriate weight on queryable fields
- [ ] Numeric fields have validators (bigint, integer, range)
- [ ] Date columns use `timestamp with time zone`
- [ ] JSDoc comments on class and public properties

### Relationships
- [ ] Use string names for entity references (avoid circular imports)
- [ ] `onDelete` behavior explicitly specified
- [ ] Inverse relationship added if parent needs access
- [ ] Foreign key column defined separately from relationship

### Migration
- [ ] Migration is idempotent (check before create)
- [ ] Uses `IF EXISTS` / `IF NOT EXISTS`
- [ ] `down()` properly reverts changes
- [ ] Indexes created on foreign keys and filtered columns
- [ ] Foreign key constraints have proper cascade behavior

### Integration
- [ ] Entity registered in DataSource entities array
- [ ] Entity exported from package index
- [ ] Shared-domain schema created
- [ ] Package builds successfully
- [ ] Migration runs without errors
- [ ] Migration rollback works

## Common Issues

### "cannot drop constraint" error
- Entity relationship conflicts with synchronize
- Solution: Never use `synchronize: true`; use migrations only

### "column does not exist" after migration
- Migration ran but entity not rebuilt
- Solution: `pnpm build` the database package

### Type mismatch in foreign key
- Using bigint instead of uuid for agent_id
- Solution: Change to `type: 'uuid'` and reference `agent.id`

## Related Documents

- `docs/architecture/entity-patterns.md`
- `packages/database/.github/instructions/entity-design.instructions.md`
- `packages/database/.github/instructions/migration-design.instructions.md`
- `packages/database/.github/instructions/foreign-key-consistency.instructions.md`
