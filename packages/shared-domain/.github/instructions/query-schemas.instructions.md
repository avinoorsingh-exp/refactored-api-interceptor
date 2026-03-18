# Query Schema Instructions

## Purpose

This file documents the patterns and requirements for **query parameter schemas** used for filtering, sorting, searching, and pagination across all API endpoints.

## File Patterns

**Applies to**: `**/common/query/*.ts`, `**/common/paging.ts`

---

## Query System Overview

```
HTTP Request
     │
     ▼
┌─────────────────────┐
│ QueryParamsSchema   │  ← Parse & validate query string
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ NormalizedQueryParams                   │
│  - offset, limit (pagination)           │
│  - filter { conditions[], operator }    │
│  - sort { conditions[] }                │
│  - search { query, fields[] }           │
└─────────────────────────────────────────┘
```

---

## Pagination Schemas

### Constants

```typescript
export const LIMIT_DEFAULT = 25 as const
export const LIMIT_MAX = 50 as const
```

### PaginationQuerySchema

Parses pagination from query parameters. **Clamps** limit to LIMIT_MAX instead of throwing:

```typescript
/**
 * Clamps a limit value to the valid range [1, LIMIT_MAX].
 * Values > LIMIT_MAX are clamped to LIMIT_MAX (no error thrown).
 * Values < 1 are clamped to 1.
 */
const clampLimit = (val: number): number => Math.min(Math.max(1, val), LIMIT_MAX)

export const PaginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .default(LIMIT_DEFAULT)
    .transform(clampLimit),
})
```

> **Note**: Limit values exceeding 50 are silently clamped to 50 rather than returning a 400 error. This provides a better UX while still enforcing the maximum.

### PaginationMetaSchema

Metadata returned in paginated responses:

```typescript
export const PaginationMetaSchema = z.object({
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  currentPage: z.number().int().min(1),
  limit: z.number().int().min(1).max(LIMIT_MAX),
  offset: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})
```

---

## Filter Schema

### Filter Operators

```typescript
export const FilterOperatorSchema = z.enum([
  'eq',        // Equals
  'ne',        // Not equals
  'gt',        // Greater than
  'gte',       // Greater than or equal
  'lt',        // Less than
  'lte',       // Less than or equal
  'like',      // Case-sensitive pattern match
  'ilike',     // Case-insensitive pattern match
  'in',        // In list
  'nin',       // Not in list
  'between',   // Between two values
  'isNull',    // Is null
  'isNotNull', // Is not null
  'contains',  // Contains substring
  'startsWith',// Starts with
  'endsWith',  // Ends with
])
```

### Logical Operators

```typescript
export const LogicalOperatorSchema = z.enum(['AND', 'OR']).default('AND')
```

### Filter Condition

```typescript
export const FilterConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  operator: FilterOperatorSchema,
  value: z.any(),
})
```

### Complete Filter

```typescript
export const FilterSchema = z.object({
  conditions: z.array(FilterConditionSchema).optional().default([]),
  logicalOperator: LogicalOperatorSchema,
})
```

---

## Sort Schema

### Sort Direction

```typescript
export const SortDirectionSchema = z
  .enum(['ASC', 'DESC', 'asc', 'desc'])
  .transform((val) => val.toUpperCase() as 'ASC' | 'DESC')
  .default('ASC')
```

### Sort Condition

```typescript
export const SortConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  direction: SortDirectionSchema,
})
```

### Complete Sort

```typescript
export const SortSchema = z.object({
  conditions: z.array(SortConditionSchema).optional().default([]),
})
```

---

## Search Schema

```typescript
export const SearchSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').optional(),
  fields: z.array(z.string().min(1)).min(1, 'At least one search field required').optional(),
})
```

---

## Combined Query Params Schema

### Full Query Parameters

```typescript
export const QueryParamsSchema = PaginationQuerySchema.extend({
  // Filter - accepts JSON string OR parsed object
  filter: z
    .union([z.string(), z.array(z.any()), z.object({...})])
    .transform((val, ctx) => { /* normalize */ })
    .optional(),

  // Sort - accepts JSON string OR parsed object
  sort: z
    .union([z.string(), z.array(z.any()), z.object({...})])
    .transform((val, ctx) => { /* normalize */ })
    .optional(),

  // Search - simple string
  search: z.string().min(1).optional(),
  
  // Search fields - comma-separated
  searchFields: z
    .string()
    .transform((val) => val.split(',').map((f) => f.trim()).filter(Boolean))
    .optional(),
})
```

---

## Requirements

### MUST Follow

1. **Always use `z.coerce` for query params**:
   ```typescript
   offset: z.coerce.number()  // ✅ Converts "10" to 10
   offset: z.number()          // ❌ Fails on string "10"
   ```

2. **Always provide defaults** for pagination:
   ```typescript
   .optional().default(0)      // ✅ Has fallback
   .optional()                  // ❌ Could be undefined
   ```

3. **Always normalize case** for enums:
   ```typescript
   .transform((val) => val.toUpperCase() as 'ASC' | 'DESC')
   ```

4. **Always validate filter fields** against allowed list (done at service layer)

5. **Always handle both JSON strings and parsed objects**:
   ```typescript
   z.union([z.string(), z.object({...})])
     .transform((val) => typeof val === 'string' ? JSON.parse(val) : val)
   ```

### MUST NOT Do

1. **Limit is clamped, not rejected** - Values > 50 are silently clamped to LIMIT_MAX (50)
2. **Never allow negative offsets** - Still throws 400 for offset < 0
3. **Never trust filter field names** - Validate against allowlist
4. **Never expose internal field names** - Map to public API names

---

## API Usage Examples

### Basic Pagination

```
GET /v1/agents?offset=0&limit=25
```

### With Filters

```
GET /v1/agents?filter={"conditions":[{"field":"status","operator":"eq","value":"active"}],"logicalOperator":"AND"}
```

### Shorthand Array Format

```
GET /v1/agents?filter=[{"field":"status","operator":"eq","value":"active"}]
```

### With Sort

```
GET /v1/agents?sort={"conditions":[{"field":"lastName","direction":"ASC"}]}
```

### With Search

```
GET /v1/agents?search=john&searchFields=firstName,lastName
```

### Combined

```
GET /v1/agents?offset=0&limit=10&filter=[{"field":"status","operator":"eq","value":"active"}]&sort=[{"field":"name","direction":"ASC"}]&search=john
```

---

## Transform Patterns

### JSON String to Object

```typescript
filter: z
  .string()
  .transform((val, ctx) => {
    if (val.trim() === '') return undefined
    try {
      return JSON.parse(val)
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid JSON format',
      })
      return z.NEVER
    }
  })
```

### Comma-Separated to Array

```typescript
searchFields: z
  .string()
  .transform((val) => 
    val.split(',')
       .map((f) => f.trim())
       .filter(Boolean)
  )
```

### Array Shorthand Normalization

```typescript
// Input:  [{"field":"name","operator":"eq","value":"John"}]
// Output: {"conditions":[...],"logicalOperator":"AND"}

filter: z
  .union([z.string(), z.array(z.any()), z.object({...})])
  .transform((val) => {
    if (Array.isArray(val)) {
      return { conditions: val, logicalOperator: 'AND' }
    }
    return val
  })
```

---

## Normalized Query Params

After parsing, queries are normalized for consistent handling:

```typescript
export const NormalizedQueryParamsSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  filter: FilterSchema.optional(),
  sort: SortSchema.optional(),
  search: z.object({
    query: z.string(),
    fields: z.array(z.string()),
  }).optional(),
})
```

---

## Integration with QueryService

The shared-domain schemas are consumed by the QueryService in the database package:

```typescript
// In repository
const queryConfig: BaseQueryConfig = {
  allowedFilterFields: ['id', 'name', 'status'],  // Whitelist
  allowedSortFields: ['id', 'name', 'created'],
  allowedSearchFields: ['id', 'name'],
  defaultSort: { field: 'name', direction: 'ASC' },
}

// QueryService validates against these lists
```

---

## Testing Requirements

```typescript
describe('PaginationQuerySchema', () => {
  it('should coerce string numbers', () => {
    const result = PaginationQuerySchema.parse({ offset: '10', limit: '25' })
    expect(result.offset).toBe(10)
    expect(result.limit).toBe(25)
  })

  it('should apply defaults', () => {
    const result = PaginationQuerySchema.parse({})
    expect(result.offset).toBe(0)
    expect(result.limit).toBe(25)
  })

  it('should clamp limit to LIMIT_MAX instead of throwing', () => {
    const result = PaginationQuerySchema.parse({ limit: 100 })
    expect(result.limit).toBe(50) // Clamped to LIMIT_MAX
  })

  it('should clamp limit below 1 to 1', () => {
    const result = PaginationQuerySchema.parse({ limit: 0 })
    expect(result.limit).toBe(1) // Clamped to minimum
  })
})

describe('FilterSchema', () => {
  it('should default logicalOperator to AND', () => {
    const result = FilterSchema.parse({ conditions: [] })
    expect(result.logicalOperator).toBe('AND')
  })

  it('should validate operator values', () => {
    expect(() => FilterSchema.parse({
      conditions: [{ field: 'name', operator: 'invalid', value: 'test' }]
    })).toThrow()
  })
})

describe('SortDirectionSchema', () => {
  it('should normalize to uppercase', () => {
    expect(SortDirectionSchema.parse('asc')).toBe('ASC')
    expect(SortDirectionSchema.parse('desc')).toBe('DESC')
  })
})
```
