# Query System Architecture

This document describes the query system including QueryService, ProjectionService, search strategies, and metadata readers.

## Overview

The query system provides:
- Type-safe field querying with automatic validation
- Flexible field projection and relation loading
- Search strategies for different data types
- Metadata extraction from entity decorators

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│ Controller                                                       │
│   @Query() query: QueryParamsDto                                │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ QueryService                                                     │
│   - Validates query params against entity decorators            │
│   - Dispatches to type-specific search strategies               │
│   - Applies filter, sort, pagination                            │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ProjectionService                                                │
│   - Applies field selection                                      │
│   - Loads relations with leftJoin + addSelect                   │
│   - Handles nested relations                                     │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Repository (TypeORM QueryBuilder)                               │
│   - Executes optimized SQL                                       │
│   - Returns paginated results                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Query Parameters

### Standard Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | string | Text search across searchable fields | `?search=john` |
| `searchFields` | string[] | Limit search to specific fields | `?searchFields=["firstName","lastName"]` |
| `filter` | object | Field-level filtering | `?filter={"status":{"eq":"active"}}` |
| `sort` | string[] | Sort order | `?sort=["lastName:asc","firstName:asc"]` |
| `fields` | string[] | Field projection | `?fields=["id","firstName"]` |
| `relations` | string[] | Relation loading | `?relations=["addresses","office"]` |
| `offset` | number | Pagination offset | `?offset=0` |
| `limit` | number | Pagination limit | `?limit=25` |

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{"status":{"eq":"active"}}` |
| `neq` | Not equals | `{"status":{"neq":"inactive"}}` |
| `gt` | Greater than | `{"amount":{"gt":100}}` |
| `gte` | Greater than or equal | `{"amount":{"gte":100}}` |
| `lt` | Less than | `{"amount":{"lt":1000}}` |
| `lte` | Less than or equal | `{"amount":{"lte":1000}}` |
| `between` | Between range | `{"amount":{"between":[100,1000]}}` |
| `in` | In list | `{"status":{"in":["active","pending"]}}` |
| `contains` | Contains substring | `{"name":{"contains":"smith"}}` |
| `startsWith` | Starts with | `{"name":{"startsWith":"john"}}` |
| `endsWith` | Ends with | `{"email":{"endsWith":"@company.com"}}` |
| `isNull` | Is null | `{"deletedAt":{"isNull":true}}` |
| `isNotNull` | Is not null | `{"email":{"isNotNull":true}}` |

## Search Strategies

### StringSearchStrategy
- Uses ILIKE for case-insensitive matching
- Supports partial, prefix, suffix, exact behaviors
- Multi-word search: `"john doe"` → OR across words

### NumericSearchStrategy
- Exact match: `"500000"` → WHERE price = 500000
- Range: `"500-1000"` → WHERE price BETWEEN 500 AND 1000
- Validates against PostgreSQL limits to prevent overflow

### DateSearchStrategy
- Year: `"2024"` → WHERE EXTRACT(YEAR FROM date) = 2024
- Month: `"2024-01"` → WHERE date >= '2024-01-01' AND date < '2024-02-01'
- Full date: `"2024-01-15"` → WHERE date::date = '2024-01-15'
- Range: `"2024-01-01,2024-12-31"` → WHERE date BETWEEN ...

### BooleanSearchStrategy
- Accepts: true/yes/1, false/no/0
- Case-insensitive

## ProjectionService Patterns

### Pattern 1: Field Selection Only

```typescript
GET /agents?fields=["agentId","firstName"]

// ProjectionService behavior:
qb.select('agent.agent_id')
qb.addSelect('agent.first_name')
// Result: Only requested fields, no relations
```

### Pattern 2: Relations Only

```typescript
GET /agents?relations=["office"]

// ProjectionService behavior:
qb.leftJoinAndSelect('agent.office', 'office')
// Result: All agent fields + all office fields
```

### Pattern 3: Fields + Relations (Critical)

```typescript
GET /agents?fields=["agentId","firstName"]&relations=["office"]

// ProjectionService behavior:
qb.select('agent.agent_id')
qb.addSelect('agent.first_name')
qb.leftJoin('agent.office', 'office')  // leftJoin, NOT leftJoinAndSelect
qb.addSelect('office.office_id')
qb.addSelect('office.name')
// Result: Only requested agent fields + configured office fields
```

**Critical Rule**: Never use `leftJoinAndSelect` when field selection is present - it overrides `select()` and returns all base entity fields.

## ProjectionConfig Structure

```typescript
export const AGENT_PROJECTION_CONFIG: ProjectionConfig = {
  // Base entity fields
  allowedFields: ['id', 'agentId', 'firstName', 'lastName', 'email'],

  // Required fields always included
  requiredFields: ['id'],

  // Default fields when none specified
  defaultFields: ['id', 'agentId', 'firstName', 'lastName'],

  // Relations configuration
  relations: {
    // Simple relation
    office: {
      property: 'office',
      alias: 'office',
      fields: ['id', 'name', 'address'],
    },

    // Filtered relation (e.g., primary only)
    primaryOffice: {
      property: 'agentOfficeAssociations',
      alias: 'agentOfficePrimary',
      fields: ['officeId', 'isPrimary'],
      condition: 'agentOfficePrimary.isPrimary = true',
      nestedRelations: {
        office: {
          property: 'office',
          alias: 'primaryOffice',
          fields: ['id', 'name'],
        },
      },
    },

    // Virtual relation (loaded by repository custom method)
    primaryEmail: {
      virtual: true,  // Skip in leftJoin, handled separately
    },
  },

  // Presets for common use cases
  presets: {
    minimal: {
      fields: ['id', 'firstName'],
    },
    default: {
      fields: ['id', 'agentId', 'firstName', 'lastName', 'email'],
      relations: ['primaryOffice'],
    },
    full: {
      fields: ['id', 'agentId', 'firstName', 'lastName', 'email', 'birthDate'],
      relations: ['addresses', 'contactMethods', 'licenses'],
    },
  },
};
```

## Type Casting Rules

### Search Operations (Always Cast)

```sql
-- UUID search
WHERE listing.listing_id::text ILIKE '%123e4567%'

-- BigInt search
WHERE listing.list_price::text ILIKE '%500000%'

-- Date search
WHERE listing.listing_date::text ILIKE '%2024%'
```

All search operations use `::text` cast for consistent ILIKE behavior.

### Filter Operations (Conditional Cast)

```sql
-- UUID exact match (no cast)
WHERE listing.listing_id = '123e4567-e89b-12d3-a456-426614174000'::uuid

-- UUID partial match (cast)
WHERE listing.listing_id::text ILIKE '%123e4567%'

-- BigInt comparison (no cast)
WHERE listing.list_price >= 500000

-- BigInt text search (cast)
WHERE listing.list_price::text ILIKE '%500%'
```

## Metadata Extraction

`SearchMetadataReader` extracts field configuration from entities:

```typescript
const searchableFields = SearchMetadataReader.getSearchableFields(AgentEntity);

// Returns:
[
  {
    propertyName: 'firstName',
    columnName: 'first_name',
    type: 'string',
    weight: 10,
    behavior: 'partial',
    description: 'Agent first name',
    validate: undefined,
  },
  {
    propertyName: 'agentId',
    columnName: 'agent_id',
    type: 'integer',
    weight: 4,
    behavior: 'exact',
    description: 'Agent ID (bigint)',
    validate: SearchValidators.bigint,
  },
]
```

## Validation Flow

1. Request arrives with query parameters
2. `QueryService.normalizeParams()` validates:
   - Fields exist on entity
   - Filter operators are valid for field type
   - Sort fields are sortable
   - Search values pass field validators
3. If validation fails: `SearchValidationException` or `FilterValidationException`
4. `ProblemDetailsFilter` formats error as RFC 9457 response

## Performance Considerations

1. **Field Selection Reduces Payload**
   - Only select needed fields
   - Specify relation fields explicitly
   - Use indexes on filtered/sorted fields

2. **Relation Loading**
   - Use leftJoin + addSelect when field selection is present
   - Avoid N+1 queries by loading relations upfront
   - Use pagination for large result sets

3. **Query Logging**
   - Log generated SQL for debugging
   - Monitor slow queries (>500ms)
   - Use EXPLAIN ANALYZE for optimization

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Using leftJoinAndSelect with field selection | Use leftJoin + addSelect |
| Not specifying relation fields | Always configure relation.fields |
| Skipping value coercion | Coerce and validate before SQL |
| No type casting for UUID/BigInt search | Apply ::text cast for LIKE/ILIKE |
| Validating only at database level | Multi-layer validation (service + DB) |
