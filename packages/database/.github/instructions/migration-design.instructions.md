```instructions
---
applyTo: "**/migrations/*.ts"
---

# Migration Design Instructions

You are an expert in TypeORM migrations for the @exprealty/database package. Migrations are the ONLY way to modify database schema - never rely on synchronize.

## Core Principles

### Idempotent Migrations
All migrations MUST be idempotent - safe to run multiple times without errors:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Check if migration was already applied
  const columnInfo = await queryRunner.query(`
    SELECT data_type FROM information_schema.columns 
    WHERE table_schema = 'core' 
    AND table_name = 'my_table' 
    AND column_name = 'my_column'
  `);
  
  // Skip if already migrated
  if (columnInfo.length > 0 && columnInfo[0].data_type === 'uuid') {
    return;
  }
  
  // Proceed with migration...
}
```

### Column Type Changes (bigint → uuid)
When migrating foreign keys from bigint to uuid:

1. **Add temporary UUID column**
2. **Populate from source table** using the legacy ID mapping
3. **Delete orphaned records** where mapping fails
4. **Drop old constraints** (PK, FK)
5. **Drop old column**
6. **Rename temp column** to original name
7. **Add NOT NULL constraint**
8. **Recreate constraints** (PK, FK with proper references)
9. **Add indexes** for query performance

```typescript
// Step 1: Add temp column
await queryRunner.query(`
  ALTER TABLE "core"."my_table" 
  ADD COLUMN IF NOT EXISTS "agent_uuid" uuid
`);

// Step 2: Populate from agent.id via agent.agent_id mapping
await queryRunner.query(`
  UPDATE "core"."my_table" mt
  SET "agent_uuid" = a."id"
  FROM "core"."agent" a
  WHERE mt."agent_id"::text = a."agent_id"::text
`);

// Step 3: Delete orphans
await queryRunner.query(`
  DELETE FROM "core"."my_table"
  WHERE "agent_uuid" IS NULL
`);
```

## Migration Naming Convention

Format: `{timestamp}-{DescriptiveName}.ts`

Examples:
- `1765940000000-MigrateAgentForeignKeysToUuid.ts`
- `1765950000000-AddIndexOnAgentLifecycleStatus.ts`
- `1765960000000-CreatePublicProfileTable.ts`

## Migration Class Structure

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration description explaining:
 * - What tables/columns are affected
 * - Why the change is needed
 * - Any data transformations performed
 * 
 * This migration is idempotent - safe to run multiple times.
 */
export class MigrateName1765940000000 implements MigrationInterface {
  name = 'MigrateName1765940000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Implementation
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback implementation
  }
}
```

## Constraint Management

### Dropping Constraints Safely
Always use `IF EXISTS` to avoid errors:

```typescript
await queryRunner.query(`
  ALTER TABLE "core"."my_table" 
  DROP CONSTRAINT IF EXISTS "PK_my_table"
`);

await queryRunner.query(`
  ALTER TABLE "core"."my_table" 
  DROP CONSTRAINT IF EXISTS "my_table_pkey"  -- Also check auto-generated name
`);
```

### Creating Foreign Keys
Always add proper ON DELETE behavior:

```typescript
await queryRunner.query(`
  ALTER TABLE "core"."my_table" 
  ADD CONSTRAINT "FK_my_table_agent" 
  FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") 
  ON DELETE CASCADE ON UPDATE NO ACTION
`);
```

## Index Management

### Create Indexes
Always use `IF NOT EXISTS`:

```typescript
await queryRunner.query(`
  CREATE INDEX IF NOT EXISTS "IDX_my_table_agent_id" 
  ON "core"."my_table" ("agent_id")
`);
```

### Drop Indexes
```typescript
await queryRunner.query(`
  DROP INDEX IF EXISTS "core"."IDX_my_table_agent_id"
`);
```

### Production Indexes
For production databases, create indexes concurrently:

```typescript
// NOTE: Cannot be in a transaction
await queryRunner.query(`
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_my_table_agent_id" 
  ON "core"."my_table" ("agent_id")
`);
```

## Schema Inspection Patterns

### Check Column Exists
```typescript
const columnExists = await queryRunner.query(`
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'core' 
  AND table_name = 'my_table' 
  AND column_name = 'my_column'
`);
if (columnExists.length === 0) return;
```

### Check Column Type
```typescript
const columnInfo = await queryRunner.query(`
  SELECT data_type FROM information_schema.columns 
  WHERE table_schema = 'core' 
  AND table_name = 'my_table' 
  AND column_name = 'agent_id'
`);
const isUuid = columnInfo[0]?.data_type === 'uuid';
```

### Check Table Exists
```typescript
const tableExists = await queryRunner.query(`
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'core' 
  AND table_name = 'my_table'
`);
```

## Rollback Implementation

Every `up()` must have a corresponding `down()` that:
1. **Reverses all changes** in opposite order
2. **Is also idempotent** - check state before reverting
3. **Restores data** where possible (FK migrations should map back)

```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Check if revert is needed
  const columnInfo = await queryRunner.query(`
    SELECT data_type FROM information_schema.columns 
    WHERE table_schema = 'core' 
    AND table_name = 'my_table' 
    AND column_name = 'agent_id'
  `);
  
  // Only revert if currently uuid
  if (columnInfo.length === 0 || columnInfo[0].data_type !== 'uuid') {
    return;
  }
  
  // Revert steps in reverse order...
}
```

## Critical Rules

1. **NEVER use synchronize** - Migrations are the only schema change mechanism
2. **ALWAYS make migrations idempotent** - Check state before modifying
3. **ALWAYS implement down()** - Rollbacks must work
4. **ALWAYS use IF EXISTS / IF NOT EXISTS** - Prevent duplicate errors
5. **USE CASCADE carefully** - Understand data deletion implications
6. **TEST on production-sized data** - Performance matters
7. **DOCUMENT the migration** - Explain what and why
8. **USE transactions** - Except for CONCURRENTLY operations
9. **ORDER constraints correctly** - Drop FK before PK, create PK before FK
10. **PRESERVE data** - Never delete data without mapping to new structure first
```
