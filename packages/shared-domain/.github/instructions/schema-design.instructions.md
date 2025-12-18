# Schema Design Instructions

## Purpose

This file documents the patterns and requirements for creating **Zod schemas** in the shared-domain package. Schemas define the shape and validation of domain entities.

## File Patterns

**Applies to**: `**/schemas/*.ts`

---

## Schema Hierarchy Pattern

Every entity follows a **Base → Expanded → Create/Update** hierarchy:

```
┌─────────────────────┐
│   EntityBaseSchema  │  ← Core fields only (list views)
└─────────┬───────────┘
          │ extends
          ▼
┌─────────────────────┐
│ EntityExpandedSchema│  ← Includes relationships (detail views)
└─────────┬───────────┘
          │ omit
          ▼
┌─────────────────────────────────────────┐
│ CreateEntityInputSchema / UpdateEntity  │ ← API inputs (no id/timestamps)
└─────────────────────────────────────────┘
```

---

## Standard Schema Template

```typescript
import { z } from 'zod'
import { AuditableSchema } from './audit.js'
import { NameBranded, EmailBranded } from '../value-objects/index.js'
import { trimmedStringMinMax, lifecycleEnum } from './base-schemas.js'

/**
 * Entity lifecycle status values.
 * @public
 */
export const ENTITY_LIFECYCLE_VALUES = [
  'new',
  'active',
  'inactive',
] as const;

/**
 * Entity lifecycle status.
 * @public
 */
export const EntityLifecycleStatus = lifecycleEnum(
  ENTITY_LIFECYCLE_VALUES,
  'errors.entity.lifecycle_status.invalid'
)

/**
 * Base schema for Entity.
 * Used for list views and minimal data fetching.
 *
 * @public
 */
export const EntityBaseSchema = z
  .object({
    id: z.string().uuid(),
    name: NameBranded,
    email: EmailBranded.optional(),
    lifecycleStatus: EntityLifecycleStatus,
    // Foreign keys
    parentId: z
      .string()
      .regex(/^\d+$/, { message: 'errors.entity.parentId.invalid' })
      .describe('Foreign key to parent (bigint as string)'),
  })
  .merge(AuditableSchema)
  .describe('Base Entity for list views')

/**
 * @public
 */
export type EntityBase = z.infer<typeof EntityBaseSchema>

/**
 * Expanded schema for Entity with relationships.
 *
 * @public
 */
export const EntityExpandedSchema = EntityBaseSchema.extend({
  parent: z.lazy(() => z.any()).optional().describe('Parent relationship'),
  children: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Entity with relationships')

/**
 * @public
 */
export type EntityExpanded = z.infer<typeof EntityExpandedSchema>

/**
 * @public
 */
export type Entity = EntityExpanded

/**
 * Schema for creating a new Entity.
 * Omits system-generated fields.
 *
 * @public
 */
export const CreateEntityInputSchema = EntityBaseSchema.omit({
  id: true,
  created: true,
  lastModified: true,
  modifiedBy: true,
})

/**
 * @public
 */
export type CreateEntityInput = z.infer<typeof CreateEntityInputSchema>

/**
 * Schema for updating an Entity.
 * All fields optional for partial updates.
 *
 * @public
 */
export const UpdateEntityInputSchema = EntityBaseSchema.omit({
  id: true,
  created: true,
  lastModified: true,
  modifiedBy: true,
}).partial()

/**
 * @public
 */
export type UpdateEntityInput = z.infer<typeof UpdateEntityInputSchema>

/**
 * Path parameter schema for Entity ID.
 *
 * @public
 */
export const EntityIdParamSchema = z.object({
  id: EntityBaseSchema.shape.id,
})

/**
 * @public
 */
export type EntityIdParam = z.infer<typeof EntityIdParamSchema>
```

---

## Requirements

### MUST Follow

1. **Always merge with `AuditableSchema`** for entities with audit fields:
   ```typescript
   .merge(AuditableSchema)
   ```

2. **Always export both schema and type**:
   ```typescript
   export const EntityBaseSchema = z.object({...})
   export type EntityBase = z.infer<typeof EntityBaseSchema>
   ```

3. **Always use i18n error messages** - Format: `errors.{entity}.{field}.{constraint}`

4. **Always document with JSDoc** - Mark `@public` for API docs

5. **Always use branded value objects** for common fields:
   ```typescript
   firstName: NameBranded,           // ✅ Correct
   firstName: z.string().min(2),     // ❌ Wrong - duplicates validation
   ```

6. **Always describe foreign keys** with format and purpose:
   ```typescript
   companyId: z
     .string()
     .regex(/^\d+$/, { message: 'errors.entity.companyId.invalid' })
     .describe('Foreign key to company (bigint as string)')
   ```

### MUST NOT Do

1. **Never omit Base/Expanded pattern** for entities with relationships
2. **Never include relations in BaseSchema** - Put them in ExpandedSchema
3. **Never use raw types** - Always use value objects or helper schemas
4. **Never duplicate validation** that exists in value-objects

---

## ID Type Patterns

### UUID Primary Keys (Standard)

```typescript
id: z.string().uuid({ message: 'errors.entity.id.invalid' })
```

### BigInt as String (Legacy Compatibility)

For entities with numeric primary keys from legacy systems:

```typescript
id: z
  .string()
  .regex(/^\d+$/, { message: 'errors.entity.id.invalid' })
  .describe('Primary key (bigint as string)')
```

### Foreign Keys

- **UUID FK**: `z.string().uuid({ message: '...' })`
- **BigInt FK**: `z.string().regex(/^\d+$/, { message: '...' })`

**CRITICAL**: Match the FK type to the referenced table's PK type!

---

## Relationship Handling

### Lazy Loading Pattern

Use `z.lazy()` to prevent circular import issues:

```typescript
export const EntityExpandedSchema = EntityBaseSchema.extend({
  // Single relationship
  parent: z.lazy(() => z.any()).optional().describe('Parent entity'),
  
  // Collection relationship
  children: z.lazy(() => z.array(z.any())).optional().describe('Child entities'),
})
```

### Why `z.any()` in Lazy?

Prevents tight coupling and circular dependencies. The actual type is inferred from the database layer.

---

## Lifecycle Status Pattern

### Using lifecycleEnum Helper

```typescript
import { lifecycleEnum } from './base-schemas.js'

// Define allowed values as const array
export const AGENT_LIFECYCLE_VALUES = [
  'joining',
  'active',
  'inactive',
] as const;

// Create enum with auto-lowercase transformation
export const AgentLifecycleStatus = lifecycleEnum(
  AGENT_LIFECYCLE_VALUES,
  'errors.agent.lifecycle_status.invalid'
)
```

### Benefits

- Automatic lowercase transformation (accepts `'ACTIVE'`, stores `'active'`)
- Type-safe enum values
- Custom i18n error message
- Consistent across all entities

---

## Input Schema Patterns

### Create Input

Omit system-generated fields:

```typescript
export const CreateEntityInputSchema = EntityBaseSchema.omit({
  id: true,          // Auto-generated
  created: true,     // Auto-generated
  lastModified: true, // Auto-generated
  modifiedBy: true,   // May be set by service
})
```

### Update Input

Same omissions + `.partial()`:

```typescript
export const UpdateEntityInputSchema = EntityBaseSchema.omit({
  id: true,
  created: true,
  lastModified: true,
  modifiedBy: true,
}).partial()
```

### Input with Transformations

For API inputs that need preprocessing:

```typescript
export const CreateAgentInput = BaseAgent.omit({...})
  .extend({
    // Accept raw string, transform + validate
    firstName: z.string().trim().pipe(NameBranded),
    email: z.string().trim().toLowerCase().pipe(EmailBranded),
  })
```

---

## Base Schema Helpers

### Available Helpers

| Helper | Purpose | Example |
|--------|---------|---------|
| `trimmedString()` | Auto-trim whitespace | `trimmedString()` |
| `trimmedStringMinMax(min, max, msg?)` | Trim + length validation | `trimmedStringMinMax(1, 255)` |
| `nonEmptyString(msg?)` | Trim + non-empty | `nonEmptyString('Required')` |
| `emailString(msg?)` | Trim + lowercase + email | `emailString()` |
| `urlString(msg?)` | Trim + URL validation | `urlString()` |
| `numericString(msg?)` | Trim + digits only | `numericString()` |
| `lifecycleEnum(values, msg?)` | Lowercase + enum | `lifecycleEnum(['active', 'inactive'])` |

### Usage

```typescript
import { trimmedStringMinMax, nonEmptyString, lifecycleEnum } from './base-schemas.js'

const MySchema = z.object({
  name: trimmedStringMinMax(1, 255, 'Name must be 1-255 characters'),
  code: nonEmptyString('Code is required'),
  status: lifecycleEnum(['new', 'active'], 'Invalid status'),
})
```

---

## Naming Conventions

| Schema Type | Naming Pattern | Example |
|-------------|----------------|---------|
| Base Schema | `{Entity}BaseSchema` | `AgentBaseSchema` |
| Expanded Schema | `{Entity}ExpandedSchema` | `AgentExpandedSchema` |
| Create Input | `Create{Entity}InputSchema` | `CreateAgentInputSchema` |
| Update Input | `Update{Entity}InputSchema` | `UpdateAgentInputSchema` |
| ID Param | `{Entity}IdParamSchema` | `AgentIdParamSchema` |
| Type (Base) | `{Entity}Base` | `AgentBase` |
| Type (Expanded) | `{Entity}Expanded` | `AgentExpanded` |
| Type (Alias) | `{Entity}` | `Agent` (= AgentExpanded) |

---

## Testing Requirements

```typescript
describe('EntityBaseSchema', () => {
  const validEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Entity',
    lifecycleStatus: 'active',
    parentId: '12345',
    created: new Date(),
    lastModified: new Date(),
    modifiedBy: 'system',
  }

  it('should validate correct entity', () => {
    expect(() => EntityBaseSchema.parse(validEntity)).not.toThrow()
  })

  it('should reject invalid UUID', () => {
    const result = EntityBaseSchema.safeParse({ ...validEntity, id: 'invalid' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('errors.entity.id.invalid')
  })

  it('should normalize lifecycle status to lowercase', () => {
    const result = EntityBaseSchema.parse({ ...validEntity, lifecycleStatus: 'ACTIVE' })
    expect(result.lifecycleStatus).toBe('active')
  })
})

describe('CreateEntityInputSchema', () => {
  it('should not require id or timestamps', () => {
    const input = {
      name: 'New Entity',
      lifecycleStatus: 'new',
      parentId: '12345',
    }
    expect(() => CreateEntityInputSchema.parse(input)).not.toThrow()
  })
})
```
