# Runbook: Database Migration Workflow

This runbook covers creating, testing, and deploying database migrations.

## Prerequisites

1. Read `packages/database/.github/instructions/migration-design.instructions.md`
2. Read `packages/database/.github/instructions/data-source-config.instructions.md`
3. Understand the changes needed

## Golden Rule

**NEVER use `synchronize: true`** - Always use migrations for schema changes.

## Creating a Migration

### Step 1: Make Entity Changes

Edit the entity file in `packages/database/src/entities/`:

```typescript
// Add new column
@Column({ name: 'new_field', type: 'text', nullable: true })
newField?: string;
```

### Step 2: Generate Migration

```bash
cd packages/database
pnpm migration:generate -- -n DescriptiveName
```

Example names:
- `AddEmailToAgent`
- `CreateContactMethodTable`
- `MigrateAgentForeignKeysToUuid`
- `AddIndexOnAgentStatus`

### Step 3: Review Generated Migration

Check the generated file in `src/migrations/`:

```typescript
export class AddEmailToAgent1234567890123 implements MigrationInterface {
  name = 'AddEmailToAgent1234567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."agent" ADD "email" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."agent" DROP COLUMN "email"`);
  }
}
```

### Step 4: Make Migration Idempotent

Edit to add safety checks:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Check if column already exists
  const columnExists = await queryRunner.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core'
    AND table_name = 'agent'
    AND column_name = 'email'
  `);

  if (columnExists.length > 0) {
    return; // Already migrated
  }

  await queryRunner.query(`
    ALTER TABLE "core"."agent" ADD "email" text
  `);
}
```

## Complex Migration Patterns

### Foreign Key Type Migration (bigint → uuid)

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Step 1: Check if already migrated
  const columnInfo = await queryRunner.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'core'
    AND table_name = 'my_table'
    AND column_name = 'agent_id'
  `);

  if (columnInfo[0]?.data_type === 'uuid') {
    return;
  }

  // Step 2: Add temporary UUID column
  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    ADD COLUMN IF NOT EXISTS "agent_uuid" uuid
  `);

  // Step 3: Populate from agent.id via agent.agent_id mapping
  await queryRunner.query(`
    UPDATE "core"."my_table" mt
    SET "agent_uuid" = a."id"
    FROM "core"."agent" a
    WHERE mt."agent_id"::text = a."agent_id"::text
  `);

  // Step 4: Delete orphans
  await queryRunner.query(`
    DELETE FROM "core"."my_table"
    WHERE "agent_uuid" IS NULL
  `);

  // Step 5: Drop old constraints
  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    DROP CONSTRAINT IF EXISTS "PK_my_table"
  `);

  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    DROP CONSTRAINT IF EXISTS "FK_my_table_agent"
  `);

  // Step 6: Drop old column
  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    DROP COLUMN "agent_id"
  `);

  // Step 7: Rename temp column
  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    RENAME COLUMN "agent_uuid" TO "agent_id"
  `);

  // Step 8: Add NOT NULL constraint
  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    ALTER COLUMN "agent_id" SET NOT NULL
  `);

  // Step 9: Recreate constraints
  await queryRunner.query(`
    ALTER TABLE "core"."my_table"
    ADD CONSTRAINT "FK_my_table_agent"
    FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
  `);

  // Step 10: Add index
  await queryRunner.query(`
    CREATE INDEX IF NOT EXISTS "IDX_my_table_agent_id"
    ON "core"."my_table" ("agent_id")
  `);
}
```

### Adding Index (Production-Safe)

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // CONCURRENTLY cannot run in a transaction
  // Remove the transaction wrapper if present

  await queryRunner.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_status"
    ON "core"."agent" ("lifecycle_status")
  `);
}
```

## Testing Migrations

### Local Testing

```bash
# Run migrations
pnpm migration:run

# Verify migration applied
pnpm migration:show

# Test rollback
pnpm migration:revert

# Re-run to verify idempotency
pnpm migration:run
pnpm migration:run  # Should not error
```

### Verify Schema

```bash
# Connect to database
psql -h localhost -p 5432 -U postgres -d agent_database

# Check table structure
\d core.my_table

# Check constraints
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'core.my_table'::regclass;

# Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'my_table' AND schemaname = 'core';
```

## Migration Commands

```bash
# Generate migration from entity changes
pnpm migration:generate -- -n MigrationName

# Run pending migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert

# Show migration status
pnpm migration:show

# Create empty migration (manual SQL)
pnpm migration:create -- -n ManualMigration
```

## Checklist

### Before Creating Migration
- [ ] Entity changes are complete
- [ ] Foreign keys use UUID (not bigint for agent references)
- [ ] Column names follow snake_case convention

### Migration Code
- [ ] Migration is idempotent (check state before modifying)
- [ ] Uses `IF EXISTS` / `IF NOT EXISTS`
- [ ] `down()` properly reverts all changes
- [ ] Constraints dropped before columns
- [ ] Indexes created on foreign keys
- [ ] Foreign keys have proper ON DELETE behavior
- [ ] Comments explain complex logic

### Testing
- [ ] Migration runs successfully
- [ ] Rollback works
- [ ] Running twice doesn't error
- [ ] Data integrity preserved
- [ ] Application starts with new schema

### Production Deployment
- [ ] Database backed up
- [ ] Migration tested on production-sized data
- [ ] Performance impact evaluated
- [ ] Rollback plan documented
- [ ] Team notified of deployment

## Common Issues

### "cannot drop constraint"
- Other objects depend on it
- Solution: Drop dependent constraints first, then recreate

### Migration not found
- TypeORM can't find migration file
- Solution: Check file is in `src/migrations/` and exported correctly

### "permission denied"
- Database user lacks ALTER privileges
- Solution: Use admin user for migrations

### Slow migration on large table
- Table lock during ALTER
- Solution: Use `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` syntax for new columns with defaults

## Related Documents

- `packages/database/.github/instructions/migration-design.instructions.md`
- `packages/database/.github/instructions/data-source-config.instructions.md`
- `docs/standards/DATABASE-MIGRATIONS-STANDARDS.md`
