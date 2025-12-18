# Testing Instructions

## Purpose

This file documents the patterns and requirements for **testing** shared-domain schemas, value objects, and utilities.

## File Patterns

**Applies to**: `**/tests/**/*.spec.ts`, `**/*.spec.ts`

---

## Testing Philosophy

The shared-domain package is **foundational** - errors here cascade across the entire platform. Tests must be:

1. **Comprehensive** - Cover all valid and invalid inputs
2. **Boundary-focused** - Test min/max constraints explicitly
3. **i18n-aware** - Verify error codes, not just failures
4. **Type-safe** - Ensure branded types work correctly

---

## Test Directory Structure

```
packages/shared-domain/
├── src/
│   ├── schemas/
│   ├── value-objects/
│   ├── common/
│   └── validation/
└── tests/
    ├── schemas/
    │   ├── agent.spec.ts
    │   ├── office.spec.ts
    │   └── ...
    ├── value-objects/
    │   ├── email.spec.ts
    │   ├── name.spec.ts
    │   └── ...
    ├── common/
    │   ├── paging.spec.ts
    │   ├── problem-details.spec.ts
    │   └── query/
    │       ├── filter.spec.ts
    │       └── sort.spec.ts
    └── validation/
        └── error-map.spec.ts
```

---

## Value Object Testing

### Standard Test Structure

```typescript
import { NameBranded, NAME } from '@exprealty/shared-domain'

describe('NameBranded', () => {
  // ===== Valid Cases =====
  describe('valid inputs', () => {
    it('should accept name at minimum length', () => {
      const result = NameBranded.safeParse('Jo')
      expect(result.success).toBe(true)
      expect(result.data).toBe('Jo')
    })

    it('should accept name at maximum length', () => {
      const name = 'A'.repeat(NAME.max)
      const result = NameBranded.safeParse(name)
      expect(result.success).toBe(true)
    })

    it('should accept names with valid special characters', () => {
      expect(NameBranded.safeParse("O'Brien").success).toBe(true)
      expect(NameBranded.safeParse('Mary-Jane').success).toBe(true)
      expect(NameBranded.safeParse('José').success).toBe(true)
    })

    it('should trim whitespace', () => {
      const result = NameBranded.safeParse('  John  ')
      expect(result.success).toBe(true)
      expect(result.data).toBe('John')
    })
  })

  // ===== Invalid Cases =====
  describe('invalid inputs', () => {
    it('should reject name below minimum length', () => {
      const result = NameBranded.safeParse('J')
      expect(result.success).toBe(false)
    })

    it('should reject name exceeding maximum length', () => {
      const name = 'A'.repeat(NAME.max + 1)
      const result = NameBranded.safeParse(name)
      expect(result.success).toBe(false)
    })

    it('should reject empty string', () => {
      const result = NameBranded.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject whitespace-only string', () => {
      const result = NameBranded.safeParse('   ')
      expect(result.success).toBe(false)
    })
  })

  // ===== Error Codes =====
  describe('i18n error codes', () => {
    it('should return correct error code for min length', () => {
      const result = NameBranded.safeParse('J')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toMatch(/errors\.shared\.name/)
    })

    it('should return correct error code for max length', () => {
      const result = NameBranded.safeParse('A'.repeat(100))
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toMatch(/errors\.shared\.name/)
    })
  })

  // ===== Type Safety =====
  describe('branded type', () => {
    it('should produce branded type', () => {
      const result = NameBranded.parse('John')
      // TypeScript will verify the brand at compile time
      const name: z.infer<typeof NameBranded> = result
      expect(name).toBe('John')
    })
  })
})
```

---

## Schema Testing

### Base Schema Tests

```typescript
import { AgentBaseSchema, AGENT_LIFECYCLE_VALUES } from '@exprealty/shared-domain'

describe('AgentBaseSchema', () => {
  const validAgent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    agentCompanyId: '660e8400-e29b-41d4-a716-446655440001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    birthDate: '1990-01-15',
    lifecycleStatus: 'active',
    created: new Date(),
    lastModified: new Date(),
    modifiedBy: 'system',
  }

  describe('valid agents', () => {
    it('should validate complete agent', () => {
      expect(() => AgentBaseSchema.parse(validAgent)).not.toThrow()
    })

    it('should accept all valid lifecycle statuses', () => {
      AGENT_LIFECYCLE_VALUES.forEach((status) => {
        const result = AgentBaseSchema.safeParse({
          ...validAgent,
          lifecycleStatus: status,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should normalize lifecycle status to lowercase', () => {
      const result = AgentBaseSchema.parse({
        ...validAgent,
        lifecycleStatus: 'ACTIVE',
      })
      expect(result.lifecycleStatus).toBe('active')
    })
  })

  describe('field validation', () => {
    it('should reject invalid UUID for id', () => {
      const result = AgentBaseSchema.safeParse({
        ...validAgent,
        id: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].path).toContain('id')
    })

    it('should reject invalid email', () => {
      const result = AgentBaseSchema.safeParse({
        ...validAgent,
        email: 'not-an-email',
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].path).toContain('email')
    })

    it('should reject invalid date format', () => {
      const result = AgentBaseSchema.safeParse({
        ...validAgent,
        birthDate: '01/15/1990',  // Wrong format
      })
      expect(result.success).toBe(false)
    })
  })
})
```

### Create/Update Input Tests

```typescript
describe('CreateAgentInputSchema', () => {
  it('should not require id', () => {
    const input = {
      agentCompanyId: '660e8400-e29b-41d4-a716-446655440001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      birthDate: '1990-01-15',
    }
    expect(() => CreateAgentInputSchema.parse(input)).not.toThrow()
  })

  it('should not require timestamps', () => {
    const input = {
      agentCompanyId: '660e8400-e29b-41d4-a716-446655440001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      birthDate: '1990-01-15',
    }
    // No created, lastModified, modifiedBy
    expect(() => CreateAgentInputSchema.parse(input)).not.toThrow()
  })

  it('should trim and transform inputs', () => {
    const result = CreateAgentInputSchema.parse({
      agentCompanyId: '660e8400-e29b-41d4-a716-446655440001',
      firstName: '  John  ',
      lastName: '  Doe  ',
      email: '  JOHN@EXAMPLE.COM  ',
      birthDate: '1990-01-15',
    })
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Doe')
    expect(result.email).toBe('john@example.com')
  })
})

describe('UpdateAgentInputSchema', () => {
  it('should allow partial updates', () => {
    const input = { firstName: 'Jane' }
    expect(() => UpdateAgentInputSchema.parse(input)).not.toThrow()
  })

  it('should allow empty object', () => {
    expect(() => UpdateAgentInputSchema.parse({})).not.toThrow()
  })
})
```

---

## Query Schema Testing

### Filter Schema

```typescript
import { FilterSchema, FilterOperatorSchema } from '@exprealty/shared-domain'

describe('FilterSchema', () => {
  it('should accept valid filter conditions', () => {
    const filter = {
      conditions: [
        { field: 'name', operator: 'eq', value: 'John' },
        { field: 'age', operator: 'gte', value: 18 },
      ],
      logicalOperator: 'AND',
    }
    expect(() => FilterSchema.parse(filter)).not.toThrow()
  })

  it('should default logicalOperator to AND', () => {
    const result = FilterSchema.parse({ conditions: [] })
    expect(result.logicalOperator).toBe('AND')
  })

  it('should accept all valid operators', () => {
    const operators = [
      'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
      'like', 'ilike', 'in', 'nin', 'between',
      'isNull', 'isNotNull', 'contains', 'startsWith', 'endsWith',
    ]
    operators.forEach((op) => {
      const result = FilterSchema.safeParse({
        conditions: [{ field: 'test', operator: op, value: 'x' }],
      })
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid operator', () => {
    const result = FilterSchema.safeParse({
      conditions: [{ field: 'test', operator: 'invalid', value: 'x' }],
    })
    expect(result.success).toBe(false)
  })
})
```

### Pagination Schema

```typescript
import { 
  PaginationQuerySchema, 
  LIMIT_DEFAULT, 
  LIMIT_MAX 
} from '@exprealty/shared-domain'

describe('PaginationQuerySchema', () => {
  it('should coerce string numbers', () => {
    const result = PaginationQuerySchema.parse({
      offset: '10',
      limit: '25',
    })
    expect(result.offset).toBe(10)
    expect(result.limit).toBe(25)
  })

  it('should apply default values', () => {
    const result = PaginationQuerySchema.parse({})
    expect(result.offset).toBe(0)
    expect(result.limit).toBe(LIMIT_DEFAULT)
  })

  it('should reject negative offset', () => {
    const result = PaginationQuerySchema.safeParse({ offset: -1 })
    expect(result.success).toBe(false)
  })

  it('should reject limit exceeding maximum', () => {
    const result = PaginationQuerySchema.safeParse({ limit: LIMIT_MAX + 1 })
    expect(result.success).toBe(false)
  })

  it('should reject zero limit', () => {
    const result = PaginationQuerySchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })
})
```

---

## Problem Details Testing

```typescript
import { 
  Problems, 
  ProblemTypes, 
  makeProblemType 
} from '@exprealty/shared-domain'

describe('Problems', () => {
  describe('validation', () => {
    it('should create validation problem', () => {
      const problem = Problems.validation(
        'Invalid input',
        [{ name: 'email', reason: 'Invalid format', in: 'body' }],
      )

      expect(problem.type).toBe(ProblemTypes.Validation)
      expect(problem.status).toBe(400)
      expect(problem.title).toBe('Validation failed')
      expect(problem.invalidParams).toHaveLength(1)
    })
  })

  describe('notFound', () => {
    it('should create 404 problem', () => {
      const problem = Problems.notFound('Agent not found', '/v1/agents/123')
      
      expect(problem.status).toBe(404)
      expect(problem.type).toBe(ProblemTypes.NotFound)
      expect(problem.instance).toBe('/v1/agents/123')
    })

    it('should use default detail', () => {
      const problem = Problems.notFound()
      expect(problem.detail).toBe('No resource matched the request path.')
    })
  })
})

describe('makeProblemType', () => {
  it('should create canonical URI', () => {
    const type = makeProblemType('not-found')
    expect(type).toBe('https://problems.exprealty.com/not-found')
  })
})
```

---

## Error Map Testing

```typescript
import { z } from 'zod'
import { validationErrorMap } from '@exprealty/shared-domain'

describe('validationErrorMap', () => {
  beforeAll(() => {
    z.setErrorMap(validationErrorMap)
  })

  afterAll(() => {
    z.setErrorMap(z.defaultErrorMap)
  })

  it.each([
    ['required', z.string(), undefined, 'errors.validation.required'],
    ['invalid email', z.string().email(), 'bad', 'errors.validation.string.invalid_email'],
    ['invalid uuid', z.string().uuid(), 'bad', 'errors.validation.string.invalid_uuid'],
    ['too small string', z.string().min(5), 'abc', 'errors.validation.string.min_length'],
    ['too big string', z.string().max(3), 'abcdef', 'errors.validation.string.max_length'],
    ['invalid enum', z.enum(['a', 'b']), 'c', 'errors.validation.invalid_enum'],
  ])('should return i18n code for %s', (_, schema, value, expected) => {
    const result = schema.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(expected)
  })
})
```

---

## Requirements

### MUST Follow

1. **Test all boundary conditions**:
   ```typescript
   it('should accept at minimum', () => { /* min value */ })
   it('should accept at maximum', () => { /* max value */ })
   it('should reject below minimum', () => { /* min - 1 */ })
   it('should reject above maximum', () => { /* max + 1 */ })
   ```

2. **Test i18n error codes explicitly**:
   ```typescript
   expect(result.error?.issues[0].message).toBe('errors.entity.field.constraint')
   ```

3. **Test all enum values**:
   ```typescript
   LIFECYCLE_VALUES.forEach((status) => {
     expect(schema.safeParse({ status }).success).toBe(true)
   })
   ```

4. **Test transformations**:
   ```typescript
   const result = schema.parse({ name: '  JOHN  ' })
   expect(result.name).toBe('john')  // trimmed and lowercased
   ```

5. **Group tests logically**:
   - `describe('valid inputs', () => {...})`
   - `describe('invalid inputs', () => {...})`
   - `describe('i18n error codes', () => {...})`
   - `describe('transformations', () => {...})`

### MUST NOT Do

1. **Never skip edge cases** - Empty strings, whitespace, null, undefined
2. **Never rely on implementation details** - Test public API only
3. **Never use magic numbers** - Import from constraints
4. **Never test Zod internals** - Test your schema behavior

---

## Coverage Requirements

| Component | Target | Critical Paths |
|-----------|--------|----------------|
| Value Objects | 100% | All constraints, transforms |
| Schemas | 95% | All fields, Create/Update |
| Query Schemas | 95% | All operators, edge cases |
| Problem Details | 90% | All problem types |
| Error Map | 90% | All Zod issue codes |
