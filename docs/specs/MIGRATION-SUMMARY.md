# Database Migration & Base/Expanded Schema Pattern - Summary

**Date:** October 21, 2025  
**Status:** ✅ Complete

## What Was Completed

### 1. Value Objects Created ✅

New branded types for domain validation:

- `PostalCodeBranded` - Validates postal codes (3-16 chars, alphanumeric)
- `CityBranded` - Validates city names (128 chars max)
- `PhoneNumberBranded` - Validates phone numbers (10-20 chars, international format)
- `UrlBranded` - Validates URLs (2048 chars max)

**Location:** `packages/shared-domain/src/value-objects/`

### 2. Base/Expanded Schema Pattern Implemented ✅

Updated entities to follow the performance-optimized pattern:

#### AgentCompany

- `AgentCompanyBaseSchema` - For list views (minimal data)
- `AgentCompanyExpandedSchema` - For detail views (with relationships)

#### Address

- `AddressBaseSchema` - For list views
- `AddressExpandedSchema` - For detail views

**Key Pattern:**

```typescript
// Base = Own fields only (fast for lists)
export const EntityBaseSchema = z.object({ ... });

// Expanded = Base + Relationships (complete for details)
export const EntityExpandedSchema = EntityBaseSchema.extend({
  relatedEntity: z.lazy(() => z.any()).optional(),
});
```

### 3. Documentation Created ✅

**ADR-002: Base and Expanded Schema Pattern**

- Location: `docs/ADRs/002-base-expanded-schema-pattern.md`
- Comprehensive guide for junior developers
- Explains when to use Base vs Expanded
- Performance benchmarks and examples
- Common mistakes to avoid

### 4. Database Reset Script Created ✅

**Location:** `scripts/reset-database.sh`

- Drops and recreates the database
- Removes all migration files
- Works with both local psql and Docker
- Ready for repeated use during development

**Usage:**

```bash
# From project root
./scripts/reset-database.sh

# Or via npm script
cd packages/database
pnpm run db:reset
```

### 5. Fresh Migration Generated & Run ✅

**Migration:** `1761066822525-InitialSchema.ts`

- Generated from current TypeORM entities
- Created all tables with proper relationships
- Successfully applied to `agent_database`

**Current Schema:**

- ✅ `addresses` - Address data
- ✅ `agent_companies` - Company/brokerage info
- ✅ `agents` - **All 20 fields** including new ones:
  - `agent_id` (bigint) - Legacy ID
  - `title`, `middle_name` - Name fields
  - `lifecycle_status` - Agent status
  - `last_modified`, `system_id` - System tracking
  - `seed_agent`, `is_staff` - Flags
  - `join_date`, `anniversary_date`, `termination_date` - Dates
- ✅ `agent_addresses` - Junction table
- ✅ Foreign keys and constraints properly set

## Current State

### Builds Successfully ✅

```bash
# shared-domain builds clean
cd packages/shared-domain && pnpm run build
# ✓ No errors

# database builds clean
cd packages/database && pnpm run build
# ✓ No errors
```

### Database Ready ✅

```sql
-- All tables created
agent_database=# \dt
               List of relations
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+----------
 public | addresses          | table | postgres
 public | agent_addresses    | table | postgres
 public | agent_companies    | table | postgres
 public | agents             | table | postgres
 public | typeorm_migrations | table | postgres
```

### Migration Applied ✅

```
Migration InitialSchema1761066822525 has been executed successfully.
```

## What's NOT Done (Future Work)

Based on the schema diagram, these entities were visible but NOT implemented yet:

### Additional Entities Needed:

1. **MLS** - MLS board information
2. **Agent MLS** - Junction table (agent ↔ MLS)
3. **Active Location** - Agent location assignments
4. **Artifact** - Document/image storage
5. **Relationship** - Agent relationships/hierarchy
6. **Sponsor Configuration** - Sponsorship settings

### Why Not Done:

- Focused on core Agent, Company, Address entities
- These were clearly visible in the schema diagram
- Provided the pattern and tools for easy addition later

## How to Add More Entities

When you're ready to add MLS, Artifact, etc.:

### 1. Create Domain Schema

```typescript
// packages/shared-domain/src/entities/mls.ts
export const MLSBaseSchema = z.object({
	id: z.string().uuid(),
	mlsId: z.string(),
	name: z.string(),
	// ... base fields only
})

export const MLSExpandedSchema = MLSBaseSchema.extend({
	// relationships
	agentMls: z.lazy(() => z.array(z.any())).optional(),
})
```

### 2. Create TypeORM Entity

```typescript
// packages/database/src/entities/mls.entity.ts
@Entity('mls')
export class MLSEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string

	// ... fields

	@OneToMany(() => AgentMLSEntity, (agentMls) => agentMls.mls)
	agentMls: AgentMLSEntity[]
}
```

### 3. Reset & Migrate

```bash
# From project root
./scripts/reset-database.sh

# Generate new migration
cd packages/database
pnpm run migration:generate ./src/migrations/AddMLSTables

# Run migration
pnpm run migration:run
```

## Developer Onboarding

For new developers, direct them to:

1. `/docs/ADRs/001-database-entity-separation.md` - Why we separate domain from persistence
2. `/docs/ADRs/002-base-expanded-schema-pattern.md` - When to use Base vs Expanded schemas

## Scripts Available

```bash
# Build all packages
pnpm build:packages

# Reset database (drops DB, removes migrations)
./scripts/reset-database.sh

# From packages/database:
pnpm run migration:generate ./src/migrations/MigrationName
pnpm run migration:run
pnpm run migration:revert
pnpm run db:reset     # Reset database
pnpm run db:fresh     # Reset + run migrations
```

## Next Steps

When ready to continue:

1. Add MLS entity (Base + Expanded schemas)
2. Add AgentMLS junction table
3. Add ActiveLocation entity
4. Add Artifact entity
5. Add Relationship entity
6. Add SponsorConfiguration entity
7. Reset database and regenerate comprehensive migration

Each follows the same pattern established here.

# Database Migrations

## Overview

TypeORM migrations are used to manage database schema changes in a version-controlled, reproducible way.

## Migration Commands

All commands should be run from the `packages/database` directory or via `pnpm --filter @exprealty/database`.

### Generate Migration (from entity changes)

Automatically generates a migration by comparing current entities to database schema:

```bash
pnpm migration:generate --name=MigrationName
```

**Example:**

```bash
pnpm migration:generate --name=AddUserTable
pnpm migration:generate --name=CompleteSchema
```

The migration will be created directly in `src/migrations/` with a timestamp prefix (e.g., `1761175880348-AddUserTable.ts`).

### Create Empty Migration (manual)

Create an empty migration file for custom SQL:

```bash
pnpm migration:create --name=CustomMigrationName
```

### Run Migrations

Apply all pending migrations:

```bash
pnpm migration:run
```

### Revert Migration

Revert the last applied migration:

```bash
pnpm migration:revert
```

### Show Migration Status

Display which migrations have been run:

```bash
pnpm migration:show
```

## Database Reset Workflow

### Fresh Database with Migrations

```bash
# Reset database and run all migrations
pnpm db:fresh
```

### Manual Reset

```bash
# 1. Drop and recreate database
docker compose exec postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS agent_database;"
docker compose exec postgres psql -U postgres -d postgres -c "CREATE DATABASE agent_database;"

# 2. Run migrations
pnpm migration:run
```

## Migration Best Practices

### 1. Review Before Committing

Always review generated migrations before committing:

- Check table names match entity names
- Verify foreign key relationships
- Ensure indexes are created where needed
- Confirm column types and constraints

### 2. Test Migrations

```bash
# Test on fresh database
pnpm db:fresh

# Test rollback
pnpm migration:revert
```

### 3. Never Edit Applied Migrations

Once a migration has been applied to any environment (dev, staging, production):

- Never edit the migration file
- Create a new migration for changes instead
- This ensures migration history consistency

### 4. CompleteSchema Pattern

For a clean start or major refactoring:

```bash
# 1. Delete old migrations
rm src/migrations/*.ts

# 2. Reset database
docker compose exec postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS agent_database;"
docker compose exec postgres psql -U postgres -d postgres -c "CREATE DATABASE agent_database;"

# 3. Generate consolidated migration
pnpm migration:generate --name=CompleteSchema

# 4. Apply new migration
pnpm migration:run
```

## Migration File Structure

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm'

export class MigrationName1234567890123 implements MigrationInterface {
	name = 'MigrationName1234567890123'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// SQL to apply changes
		await queryRunner.query(`CREATE TABLE ...`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQL to revert changes
		await queryRunner.query(`DROP TABLE ...`)
	}
}
```

## Troubleshooting

### Migration Generated in Wrong Location

**Old behavior:** Migrations generated in root directory, required manual move.

**Fixed:** Updated `package.json` scripts to specify output path. Migrations now generate directly in `src/migrations/`.

### "No changes in database schema"

This means your entities match the current database schema. Common causes:

- Entities already synced with database
- TypeORM can't detect your changes (complex column changes)
- Database connection issue

Solution: Use `migration:create` for manual migrations if needed.

### Migration Ordering Issues

TypeORM runs migrations in timestamp order. If you have foreign key dependencies:

- Ensure parent tables are created before child tables
- Use multiple migrations if needed
- Check the `up()` method execution order

## Environment Variables

Database connection is configured in `src/data-source.ts`:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=agent_database
```

Set these in your `.env` file or environment before running migrations.
