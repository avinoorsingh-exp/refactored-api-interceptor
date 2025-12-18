# Validation & Error Map Instructions

## Purpose

This file documents the patterns and requirements for **validation error handling** and **i18n error code mapping** across the platform.

## File Patterns

**Applies to**: `**/validation/*.ts`, `**/common/error-map.ts`

---

## Error Map Overview

The validation error map transforms Zod's default error messages into standardized i18n codes for client-side localization.

```
Zod Default Message          i18n Error Code
─────────────────────────    ────────────────────────────────
"Expected number"        →   "errors.validation.type.expected_number"
"Required"               →   "errors.validation.required"
"Invalid email"          →   "errors.validation.string.invalid_email"
"String must contain at  →   "errors.validation.string.min_length"
 least 5 characters"
```

---

## Error Map Implementation

```typescript
import { z } from 'zod'

export const validationErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return { message: 'errors.validation.required' }
      }
      return { message: `errors.validation.type.expected_${issue.expected}` }

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'errors.validation.string.invalid_email' }
      }
      if (issue.validation === 'url') {
        return { message: 'errors.validation.string.invalid_url' }
      }
      if (issue.validation === 'uuid') {
        return { message: 'errors.validation.string.invalid_uuid' }
      }
      if (issue.validation === 'regex') {
        return { message: 'errors.validation.string.invalid_format' }
      }
      return { message: 'errors.validation.string.invalid' }

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        if (issue.minimum === 1) {
          return { message: 'errors.validation.required' }
        }
        return { message: 'errors.validation.string.min_length' }
      }
      if (issue.type === 'number') {
        return { message: 'errors.validation.number.too_small' }
      }
      if (issue.type === 'array') {
        return { message: 'errors.validation.array.min_items' }
      }
      return { message: 'errors.validation.too_small' }

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: 'errors.validation.string.max_length' }
      }
      if (issue.type === 'number') {
        return { message: 'errors.validation.number.too_large' }
      }
      if (issue.type === 'array') {
        return { message: 'errors.validation.array.max_items' }
      }
      return { message: 'errors.validation.too_big' }

    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'errors.validation.invalid_enum' }

    case z.ZodIssueCode.invalid_date:
      return { message: 'errors.validation.invalid_date' }

    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'errors.validation.unrecognized_keys' }

    case z.ZodIssueCode.custom:
      return { message: issue.message || 'errors.validation.custom' }

    default:
      return { message: ctx.defaultError }
  }
}
```

---

## i18n Error Code Patterns

### Standard Pattern

```
errors.{domain}.{field}.{constraint}
```

### Hierarchy

| Level | Pattern | Example |
|-------|---------|---------|
| Global | `errors.validation.*` | `errors.validation.required` |
| Shared | `errors.shared.{field}.*` | `errors.shared.email.invalid` |
| Entity | `errors.{entity}.{field}.*` | `errors.agent.email.invalid` |

### Common Error Codes

```
errors.validation.required
errors.validation.type.expected_string
errors.validation.type.expected_number
errors.validation.string.min_length
errors.validation.string.max_length
errors.validation.string.invalid_email
errors.validation.string.invalid_url
errors.validation.string.invalid_uuid
errors.validation.string.invalid_format
errors.validation.number.too_small
errors.validation.number.too_large
errors.validation.array.min_items
errors.validation.array.max_items
errors.validation.invalid_enum
errors.validation.invalid_date
errors.validation.unrecognized_keys
```

---

## Using Error Map

### Global Registration

```typescript
import { z } from 'zod'
import { validationErrorMap } from '@exprealty/shared-domain'

// Set globally for all Zod schemas
z.setErrorMap(validationErrorMap)
```

### Per-Schema Override

```typescript
const schema = z.object({
  email: z.string().email({ message: 'errors.agent.email.invalid' }),
})
```

---

## Custom Error Messages in Schemas

### Inline Messages

```typescript
// Simple message
z.string().min(2, { message: 'errors.shared.name.min' })

// Object format
z.string().min(2, {
  message: 'errors.shared.name.min',
})
```

### Entity-Specific Errors

```typescript
export const AgentIdParamSchema = z.object({
  id: z
    .string()
    .uuid({ message: 'errors.agent.id.invalid' })  // Entity-specific
    .describe('Agent ID (UUID)'),
})
```

### Shared/Reusable Errors

```typescript
export const EmailBranded = z
  .string()
  .email({ message: 'errors.shared.email.format' })  // Shared across entities
  .max(255, { message: 'errors.shared.email.max' })
  .brand<'Email'>()
```

---

## Requirements

### MUST Follow

1. **Always use i18n error codes**, never raw messages:
   ```typescript
   z.string().email({ message: 'errors.shared.email.invalid' })  // ✅
   z.string().email({ message: 'Invalid email address' })         // ❌
   ```

2. **Follow error code hierarchy**:
   - Global validation: `errors.validation.*`
   - Shared fields: `errors.shared.{field}.*`
   - Entity fields: `errors.{entity}.{field}.*`

3. **Always provide context** in entity-specific errors:
   ```typescript
   // Agent-specific
   errors.agent.firstName.required
   errors.agent.lifecycleStatus.invalid
   
   // Office-specific
   errors.office.name.required
   ```

4. **Use consistent constraint suffixes**:
   | Suffix | Usage |
   |--------|-------|
   | `.required` | Missing/undefined value |
   | `.min` | Below minimum length/value |
   | `.max` | Above maximum length/value |
   | `.format` | Invalid format (regex) |
   | `.invalid` | General invalid value |
   | `.type` | Wrong type |

### MUST NOT Do

1. **Never use raw English messages** in schema definitions
2. **Never include dynamic values** in error codes (use params instead)
3. **Never skip error codes** for any validation

---

## Zod Issue Codes Reference

| Zod Issue Code | Description | Suggested i18n |
|----------------|-------------|----------------|
| `invalid_type` | Wrong type received | `errors.validation.type.expected_{type}` |
| `invalid_string` | String validation failed | `errors.validation.string.{validation}` |
| `too_small` | Value below minimum | `errors.validation.{type}.min_*` |
| `too_big` | Value above maximum | `errors.validation.{type}.max_*` |
| `invalid_enum_value` | Not in enum | `errors.validation.invalid_enum` |
| `invalid_date` | Invalid date | `errors.validation.invalid_date` |
| `invalid_literal` | Literal mismatch | `errors.validation.invalid_literal` |
| `unrecognized_keys` | Extra properties | `errors.validation.unrecognized_keys` |
| `invalid_union` | No union match | `errors.validation.invalid_union` |
| `custom` | Custom validation | Use provided message |

---

## Validation Pipe Integration

### NestJS ZodValidationPipe

```typescript
import { PipeTransform, BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { Problems } from '@exprealty/shared-domain'

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(
    private schema: T,
    private i18nPrefix: string = 'validation',
  ) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value)
    
    if (!result.success) {
      const invalidParams = result.error.issues.map((issue) => ({
        name: issue.path.join('.'),
        reason: issue.message,  // Already i18n code from error map
        in: 'body' as const,
      }))

      throw new BadRequestException(
        Problems.validation(
          `${this.i18nPrefix}.validation_failed`,
          invalidParams,
        ),
      )
    }

    return result.data
  }
}
```

### Usage in Controllers

```typescript
@Post()
async create(
  @Body(new ZodValidationPipe(CreateAgentInputSchema, 'agent'))
  body: CreateAgentInput,
) {
  return this.service.create(body)
}
```

---

## Error Response Format

Validation errors are returned as RFC 9457 Problem Details:

```json
{
  "type": "https://problems.exprealty.com/validation-error",
  "title": "Validation failed",
  "status": 400,
  "detail": "agent.validation_failed",
  "invalidParams": [
    {
      "name": "email",
      "reason": "errors.shared.email.format",
      "in": "body"
    },
    {
      "name": "firstName",
      "reason": "errors.validation.required",
      "in": "body"
    }
  ]
}
```

---

## Testing Requirements

```typescript
describe('validationErrorMap', () => {
  beforeAll(() => {
    z.setErrorMap(validationErrorMap)
  })

  it('should return i18n code for required fields', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({})
    
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('errors.validation.required')
  })

  it('should return i18n code for invalid email', () => {
    const schema = z.string().email()
    const result = schema.safeParse('invalid')
    
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('errors.validation.string.invalid_email')
  })

  it('should return i18n code for too_small strings', () => {
    const schema = z.string().min(5)
    const result = schema.safeParse('abc')
    
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('errors.validation.string.min_length')
  })

  it('should preserve custom messages', () => {
    const schema = z.string().min(2, { message: 'errors.agent.name.min' })
    const result = schema.safeParse('a')
    
    expect(result.success).toBe(false)
    // Custom message takes precedence
    expect(result.error?.issues[0].message).toBe('errors.agent.name.min')
  })
})
```
