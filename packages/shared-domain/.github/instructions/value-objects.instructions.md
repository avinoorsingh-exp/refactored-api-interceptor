# Value Objects Design Instructions

## Purpose

This file documents the patterns and requirements for creating and using **branded value objects** in the shared-domain package. Value objects are the foundation of type-safe domain modeling.

## File Patterns

**Applies to**: `**/value-objects/*.ts`

---

## Core Concept: Branded Types

Branded types provide compile-time type safety by making structurally identical types (like two strings) incompatible at the type level.

```typescript
// Without branding: These are interchangeable at compile-time (DANGEROUS)
const email: string = 'test@example.com'
const name: string = 'John Doe'
// assignName(email) // Would compile, but is semantically wrong!

// With branding: Compiler prevents mixing
const email: Email = EmailBranded.parse('test@example.com')  // Email branded
const name: Name = NameBranded.parse('John Doe')              // Name branded
// assignName(email) // ❌ Compile error - types are incompatible
```

---

## Value Object Structure

### Standard Template

```typescript
import { z } from 'zod'

/**
 * Branded type for [description].
 * [Explain validation rules and constraints]
 *
 * @public
 */
export const FieldBranded = z
  .string({ message: 'errors.shared.field.required' })
  .min(MIN, { message: 'errors.shared.field.min' })
  .max(MAX, { message: 'errors.shared.field.max' })
  .regex(/^pattern$/, { message: 'errors.shared.field.format' })
  .brand<'Field'>()

/**
 * Type alias for branded field strings.
 *
 * @public
 */
export type Field = z.infer<typeof FieldBranded>
```

---

## Existing Value Objects Reference

| Value Object | File | Brand | Constraints |
|--------------|------|-------|-------------|
| `NameBranded` | `name.ts` | `'Name'` | min: 2, max: 50, pattern: letters/spaces/hyphens |
| `EmailBranded` | `email.ts` | `'Email'` | Zod email validation, max: 255 |
| `PhoneNumberBranded` | `phone-number.ts` | `'PhoneNumber'` | min: 10, max: 20, international format |
| `UrlBranded` | `url.ts` | `'Url'` | Zod URL validation, max: 2048 |
| `PostalCodeBranded` | `postal-code.ts` | `'PostalCode'` | min: 3, max: 16, alphanumeric |
| `CityBranded` | `city.ts` | `'City'` | min: 1, max: 128, letters/spaces/hyphens |
| `HashBranded` | `hash.ts` | `'Hash'` | max: 200, base64/hex/bcrypt-safe chars |
| `DateOnlyISO` | `dates.ts` | `'DateOnlyISO'` | YYYY-MM-DD format regex |
| `InstantUTC` | `dates.ts` | `'InstantUTC'` | JavaScript Date object |

---

## Requirements

### MUST Follow

1. **Always use `.brand<'TypeName'>()`** - Create a unique type identity
2. **Always export both schema and type**:
   ```typescript
   export const FieldBranded = z.string().brand<'Field'>()
   export type Field = z.infer<typeof FieldBranded>
   ```
3. **Always use i18n error codes** - Format: `errors.shared.{field}.{constraint}`
4. **Always add JSDoc** - Mark as `@public` for API documentation
5. **Import constraints from `contraints.ts`** - Single source of truth

### MUST NOT Do

1. **Never create unbounded strings** - Always set `max` length
2. **Never duplicate validation logic** - Use shared constraints
3. **Never use raw types in domain schemas** - Always use branded types
4. **Never brand with lowercase** - Use PascalCase: `'Email'` not `'email'`

---

## Constraint Integration

### Import from Central Constraints

```typescript
import { NAME, EMAIL, PHONE } from './contraints.js'

export const NameBranded = z
  .string()
  .min(NAME.min, { message: 'errors.shared.name.min' })
  .max(NAME.max, { message: 'errors.shared.name.max' })
  .brand<'Name'>()
```

### Constraints File Pattern

The `contraints.ts` file is the **single source of truth** for validation limits:

```typescript
// In contraints.ts
export const NAME = { min: 2, max: 50 } as const
export const EMAIL = { maxLen: 255 } as const
export const PHONE = { maxLen: 20, e164: /^\+[1-9]\d{1,14}$/ } as const
```

---

## Date/Time Value Objects

### DateOnlyISO (Calendar Date)

Use for dates without time (birthdate, expiration date):

```typescript
export const DateOnlyISO = z
  .string({ message: 'errors.shared.date.required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'errors.shared.date.iso' })
  .brand<'DateOnlyISO'>()
```

### InstantUTC (Timestamp)

Use for exact moments in time (created, modified):

```typescript
export const InstantUTC = z
  .date({ message: 'errors.shared.instant.invalid' })
  .brand<'InstantUTC'>()
```

---

## Adding a New Value Object

### Step-by-Step

1. **Add constraints** to `contraints.ts` (if new limits needed):
   ```typescript
   export const NEW_FIELD = { min: 1, max: 100 } as const
   ```

2. **Create the value object** in `value-objects/new-field.ts`:
   ```typescript
   import { z } from 'zod'
   import { NEW_FIELD } from './contraints.js'

   export const NewFieldBranded = z
     .string({ message: 'errors.shared.newField.required' })
     .min(NEW_FIELD.min, { message: 'errors.shared.newField.min' })
     .max(NEW_FIELD.max, { message: 'errors.shared.newField.max' })
     .brand<'NewField'>()

   export type NewField = z.infer<typeof NewFieldBranded>
   ```

3. **Export from `index.ts`**:
   ```typescript
   export { NewFieldBranded } from './new-field.js'
   export type { NewField } from './new-field.js'
   ```

4. **Add tests** in `tests/value-objects/new-field.spec.ts`

---

## Transform Patterns

### Trim Before Validate

```typescript
export const NameBranded = z
  .string()
  .transform((val) => val.trim())
  .pipe(
    z.string()
      .min(NAME.min)
      .max(NAME.max)
  )
  .brand<'Name'>()
```

### Lowercase + Trim (for emails)

```typescript
export const EmailBranded = z
  .string()
  .transform((val) => val.trim().toLowerCase())
  .pipe(z.string().email())
  .brand<'Email'>()
```

---

## Usage in Domain Schemas

### Correct Usage

```typescript
import { NameBranded, EmailBranded, DateOnlyISO } from '../value-objects/index.js'

export const AgentSchema = z.object({
  firstName: NameBranded,           // ✅ Branded type
  lastName: NameBranded,            // ✅ Branded type
  email: EmailBranded,              // ✅ Branded type
  birthDate: DateOnlyISO,           // ✅ Branded type
})
```

### Incorrect Usage

```typescript
export const AgentSchema = z.object({
  firstName: z.string().min(2).max(50),  // ❌ Raw string, not branded
  email: z.string().email(),              // ❌ Raw string, validation duplicated
})
```

---

## Testing Requirements

```typescript
describe('NameBranded', () => {
  it('should accept valid names', () => {
    expect(() => NameBranded.parse('John')).not.toThrow()
    expect(() => NameBranded.parse("O'Brien")).not.toThrow()
  })

  it('should reject names below minimum length', () => {
    expect(() => NameBranded.parse('J')).toThrow()
  })

  it('should reject names exceeding maximum length', () => {
    expect(() => NameBranded.parse('A'.repeat(51))).toThrow()
  })

  it('should provide i18n error codes', () => {
    const result = NameBranded.safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/errors\.shared\.name/)
  })
})
```
