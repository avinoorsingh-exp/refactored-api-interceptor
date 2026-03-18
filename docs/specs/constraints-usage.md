# Shared Constraints System

## Overview

To maintain consistency between Zod schemas (domain layer) and TypeORM entities (database layer), we use a centralized constraints system defined in `packages/shared-domain/src/value-objects/contraints.ts`.

## Philosophy

**DRY Principle**: Define field length constraints once, use everywhere.

When you change a max length in the constraints file, both the Zod validation and the database column definition automatically stay in sync.

## Available Constraints

All constraints are exported from `@exprealty/shared-domain` with a `_CONSTRAINTS` suffix to avoid naming conflicts:

- `NAME_CONSTRAINTS` - Name fields (min: 2, max: 50)
- `PHONE_CONSTRAINTS` - Phone numbers (maxLen: 20)
- `EMAIL_CONSTRAINTS` - Email addresses (maxLen: 255)
- `ADDRESS_CONSTRAINTS` - Address fields (line, city, unit, postal, countryAlpha2Len)
- `AGENT_CONSTRAINTS` - Agent entity fields
- `COMPANY_CONSTRAINTS` - Company entity fields
- `MLS_CONSTRAINTS` - MLS entity fields
- `STATE_CONSTRAINTS` - State entity fields
- ... and many more (see `contraints.ts` for complete list)

## Usage in Zod Schemas (Domain Layer)

```typescript
import { z } from 'zod'
import { MLS } from '../value-objects/contraints.js'

export const MLSBaseSchema = z.object({
	name: z.string().min(MLS.name.min).max(MLS.name.max),
	shortName: z.string().max(MLS.shortName.max).optional(),
	website: z.string().max(MLS.website.max).optional(),
	modifiedBy: z.string().max(MLS.modifiedBy.max),
})
```

## Usage in TypeORM Entities (Database Layer)

```typescript
import { Entity, Column } from 'typeorm'
import { MLS_CONSTRAINTS } from '@exprealty/shared-domain'

@Entity('mls')
export class MLSEntity {
	@Column({ type: 'varchar', length: MLS_CONSTRAINTS.name.max })
	name!: string

	@Column({
		name: 'short_name',
		type: 'varchar',
		length: MLS_CONSTRAINTS.shortName.max,
		nullable: true,
	})
	shortName?: string

	@Column({ type: 'varchar', length: MLS_CONSTRAINTS.website.max, nullable: true })
	website?: string

	@Column({
		name: 'modified_by',
		type: 'varchar',
		length: MLS_CONSTRAINTS.modifiedBy.max,
	})
	modifiedBy!: string
}
```

## Benefits

1. **Single Source of Truth**: Change once, applies everywhere
2. **Type Safety**: TypeScript enforces the constraint object structure
3. **Consistency**: Guarantees Zod and TypeORM use the same limits
4. **Maintainability**: Easy to find and update field constraints
5. **Documentation**: Constraints are self-documenting

## Adding New Constraints

When adding a new entity, update `contraints.ts`:

```typescript
/**
 * MyNewEntity field constraints.
 * @public
 */
export const MY_NEW_ENTITY = {
	name: { min: 1, max: 255 },
	description: { max: 1000 },
	code: { max: 50 },
} as const
```

Then export it in `shared-domain/src/index.ts`:

```typescript
export {
	// ... existing exports
	MY_NEW_ENTITY as MY_NEW_ENTITY_CONSTRAINTS,
} from './value-objects/contraints.js'
```

## Migration Impact

When you change a constraint that affects database column length:

1. Update the constraint in `contraints.ts`
2. Rebuild `shared-domain`: `pnpm build`
3. Rebuild `database`: `pnpm build`
4. Generate a migration: `pnpm migration:generate FieldLengthUpdate`
5. Review and apply the migration

The migration will contain the ALTER TABLE statements to adjust column lengths.

## Example: Changing a Field Length

**Before:**

```typescript
export const MLS = {
	name: { min: 1, max: 255 },
	// ...
} as const
```

**After (increasing max length):**

```typescript
export const MLS = {
	name: { min: 1, max: 500 }, // Changed from 255 to 500
	// ...
} as const
```

Both Zod schema and TypeORM entity automatically use the new length of 500 after rebuild.

## Best Practices

1. **Always use constraints** for varchar/string fields with max lengths
2. **Keep constraints reasonable** - overly large fields waste database space
3. **Group related fields** in the same constraint object (e.g., all MLS fields together)
4. **Use descriptive names** for constraint properties that match entity field names
5. **Add TSDoc comments** for each constraint object explaining its purpose
6. **Mark experimental constraints** with `@beta` tag

## Common Patterns

### Optional Fields

```typescript
// Zod
description: z.string().max(ENTITY.description.max).optional()

// TypeORM
@Column({ type: 'varchar', length: ENTITY_CONSTRAINTS.description.max, nullable: true })
description?: string;
```

### Required Fields with Min/Max

```typescript
// Zod
name: z.string().min(ENTITY.name.min).max(ENTITY.name.max)

// TypeORM
@Column({ type: 'varchar', length: ENTITY_CONSTRAINTS.name.max })
name!: string;
```

### Enums (No Constraint Needed)

```typescript
// Zod - enums don't need length constraints
status: z.enum(['Active', 'Inactive'])

// TypeORM - use reasonable length for all enum values
@Column({ type: 'varchar', length: 50 })
status!: string;
```
