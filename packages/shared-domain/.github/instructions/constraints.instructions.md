# Constraints Design Instructions

## Purpose

This file documents the patterns and requirements for the **constraints system** - the single source of truth for validation limits shared between Zod schemas and TypeORM entities.

## File Patterns

**Applies to**: `**/value-objects/contraints.ts`, `**/value-objects/constraints.ts`

---

## Core Principle: Single Source of Truth

```
┌─────────────────────────────────┐
│     contraints.ts               │  ← SINGLE SOURCE OF TRUTH
│   NAME = { min: 2, max: 50 }    │
└────────────┬────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌───────────┐   ┌────────────────┐
│ Zod Schema│   │ TypeORM Entity │
│ .min(2)   │   │ varchar(50)    │
│ .max(50)  │   │ Check(len>=2)  │
└───────────┘   └────────────────┘
```

**CRITICAL**: Always import constraints from this file. Never hardcode limits.

---

## Constraint Structure

### Standard Pattern

```typescript
/**
 * [Entity/Field] constraints for validation.
 * @public
 */
export const ENTITY_FIELD = {
  min: number,           // Minimum length/value
  max: number,           // Maximum length/value
  pattern?: RegExp,      // Validation regex (if applicable)
} as const
```

### Examples

```typescript
// Simple min/max
export const NAME = { min: 2, max: 50 } as const

// With pattern
export const PHONE = {
  e164: /^\+[1-9]\d{1,14}$/,
  maxLen: 20,
} as const

// Complex entity constraints
export const AGENT = {
  firstName: { min: 1, max: 100 },
  lastName: { min: 1, max: 100 },
  suffix: { min: 1, max: 20 },
  title: { min: 1, max: 50 },
  lifecycleStatus: { max: 50 },
} as const
```

---

## Existing Constraints Reference

| Constant | Fields | Values |
|----------|--------|--------|
| `NAME` | `min`, `max` | 2, 50 |
| `PHONE` | `e164`, `maxLen` | regex, 20 |
| `EMAIL` | `maxLen` | 255 |
| `ADDRESS` | `line`, `city`, `unit`, `postal`, `countryAlpha2Len` | various |
| `AGENT` | `firstName`, `lastName`, `suffix`, `title`, `lifecycleStatus` | various |
| `COMPANY` | `name`, `email` | various |
| `OFFICE` | `name` | 1, 255 |
| `EXTERNAL_REFERENCE` | `systemCode`, `refKey`, `refValue` | various |
| `LANGUAGE` | `name`, `code` | various |
| `CONTACT_METHOD` | `name`, `channel`, `subType`, `value` | various |
| `SPECIALTY` | `name` | 1, 255 |
| `LICENSE` | `type`, `firstName`, `lastName`, etc. | various |
| `NOTE` | `actor` | 1, 255 |
| `LIFECYCLE_EVENT` | `actor`, `type` | various |
| `RELATIONSHIP` | `type` | 50 |

---

## Requirements

### MUST Follow

1. **Always use `as const`** - Ensures literal types:
   ```typescript
   export const NAME = { min: 2, max: 50 } as const  // ✅
   export const NAME = { min: 2, max: 50 }           // ❌ Types are number, not 2/50
   ```

2. **Always export with JSDoc** - Document purpose:
   ```typescript
   /**
    * Agent entity field constraints.
    * @public
    */
   export const AGENT = { ... } as const
   ```

3. **Use consistent naming**:
   - Top-level: `SCREAMING_SNAKE_CASE`
   - Nested: `camelCase`
   ```typescript
   export const EXTERNAL_REFERENCE = {
     systemCode: { min: 1, max: 100 },
     refKey: { min: 1, max: 255 },
   } as const
   ```

4. **Group by entity** for complex constraints:
   ```typescript
   export const LICENSE = {
     type: { max: 50 },
     firstName: { min: 1, max: 100 },
     lastName: { min: 1, max: 100 },
     number: { min: 1, max: 100 },
   } as const
   ```

### MUST NOT Do

1. **Never hardcode limits in Zod schemas**:
   ```typescript
   // ❌ WRONG
   z.string().min(2).max(50)
   
   // ✅ CORRECT
   import { NAME } from './contraints.js'
   z.string().min(NAME.min).max(NAME.max)
   ```

2. **Never hardcode limits in TypeORM entities**:
   ```typescript
   // ❌ WRONG
   @Column({ type: 'varchar', length: 50 })
   
   // ✅ CORRECT
   import { NAME } from '@exprealty/shared-domain'
   @Column({ type: 'varchar', length: NAME.max })
   ```

3. **Never modify existing constraints** without updating all usages

---

## Usage in Zod Schemas

### Value Objects

```typescript
import { NAME, EMAIL } from './contraints.js'

export const NameBranded = z
  .string()
  .min(NAME.min, { message: 'errors.shared.name.min' })
  .max(NAME.max, { message: 'errors.shared.name.max' })
  .brand<'Name'>()

export const EmailBranded = z
  .string()
  .email()
  .max(EMAIL.maxLen, { message: 'errors.shared.email.max' })
  .brand<'Email'>()
```

### Entity Schemas

```typescript
import { AGENT, LICENSE } from '../value-objects/contraints.js'

export const AgentBaseSchema = z.object({
  firstName: z.string().min(AGENT.firstName.min).max(AGENT.firstName.max),
  lastName: z.string().min(AGENT.lastName.min).max(AGENT.lastName.max),
})

export const LicenseBaseSchema = z.object({
  type: z.string().max(LICENSE.type.max),
  number: z.string().min(LICENSE.number.min).max(LICENSE.number.max),
})
```

---

## Usage in TypeORM Entities

```typescript
import { NAME, EMAIL, AGENT } from '@exprealty/shared-domain'

@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity extends AuditableEntity {
  @Column({ 
    name: 'first_name', 
    type: 'varchar', 
    length: AGENT.firstName.max 
  })
  firstName!: string

  @Column({ 
    name: 'email', 
    type: 'varchar', 
    length: EMAIL.maxLen 
  })
  email!: string
}
```

---

## Adding New Constraints

### Step-by-Step

1. **Define in `contraints.ts`**:
   ```typescript
   /**
    * NewEntity field constraints.
    * @public
    */
   export const NEW_ENTITY = {
     fieldA: { min: 1, max: 100 },
     fieldB: { max: 255 },
   } as const
   ```

2. **Use in Zod schema** (`schemas/new-entity.ts`):
   ```typescript
   import { NEW_ENTITY } from '../value-objects/contraints.js'
   
   export const NewEntityBaseSchema = z.object({
     fieldA: z.string().min(NEW_ENTITY.fieldA.min).max(NEW_ENTITY.fieldA.max),
     fieldB: z.string().max(NEW_ENTITY.fieldB.max),
   })
   ```

3. **Use in TypeORM entity** (`packages/database`):
   ```typescript
   import { NEW_ENTITY } from '@exprealty/shared-domain'
   
   @Column({ type: 'varchar', length: NEW_ENTITY.fieldA.max })
   fieldA!: string
   ```

4. **Document migration** if changing existing limits

---

## Pattern Constraints

### When to Use Patterns

Use regex patterns for:
- Phone numbers (E.164 format)
- ID formats (UUID regex)
- Codes (state codes, country codes)

```typescript
export const ID = {
  uuidRegex: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const

export const PHONE = {
  e164: /^\+[1-9]\d{1,14}$/,
  maxLen: 20,
} as const
```

### Using Patterns in Zod

```typescript
import { ID, PHONE } from './contraints.js'

const UuidSchema = z.string().regex(ID.uuidRegex, { message: 'errors.id.format' })
const PhoneSchema = z.string().regex(PHONE.e164, { message: 'errors.phone.format' })
```

---

## Database Alignment

### Constraint → Column Type Mapping

| Constraint Type | PostgreSQL Column |
|-----------------|-------------------|
| `{ max: 50 }` | `varchar(50)` |
| `{ min: 1, max: 100 }` | `varchar(100) + CHECK` |
| `{ maxLen: 255 }` | `varchar(255)` |

### Migration Considerations

When changing constraints:

1. **Increasing max**: Usually safe, may need migration for index changes
2. **Decreasing max**: DANGEROUS - requires data validation first
3. **Adding min**: May require data cleanup/migration
4. **Changing pattern**: Requires data validation

---

## Testing Requirements

```typescript
describe('Constraints', () => {
  describe('NAME', () => {
    it('should have correct min/max values', () => {
      expect(NAME.min).toBe(2)
      expect(NAME.max).toBe(50)
    })
  })

  describe('PHONE', () => {
    it('should have valid E.164 pattern', () => {
      expect(PHONE.e164.test('+1234567890')).toBe(true)
      expect(PHONE.e164.test('1234567890')).toBe(false)  // Missing +
      expect(PHONE.e164.test('+0123456789')).toBe(false) // Starts with 0
    })
  })

  describe('Type safety', () => {
    it('should be readonly', () => {
      // TypeScript should prevent this at compile time
      // @ts-expect-error - testing immutability
      NAME.min = 5
    })
  })
})
```
