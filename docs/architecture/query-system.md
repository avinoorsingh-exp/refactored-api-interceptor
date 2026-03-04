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

## Virtual Relations

Virtual relations are relations that require custom loading logic that can't be handled by the standard `ProjectionService`. They are marked with `virtual: true` in the projection config.

### When to Use Virtual Relations

Use virtual relations when you need:
- **Filtered JOINs**: Load only records matching a condition (e.g., `isPrimary = true`)
- **Computed relations**: Relations derived from other data
- **Complex JOIN conditions**: JOINs that can't be expressed with standard TypeORM relation decorators

### How Virtual Relations Work

1. **ProjectionService skips them**: When `virtual: true`, `ProjectionService.applyRelations()` skips the relation
2. **Repository loads them**: The repository implements custom loading via `leftJoinAndMapOne` or similar
3. **MapToDomain handles them**: The `mapToDomain()` method maps the loaded data to the response

### Example: primaryEmail Virtual Relation

```typescript
// 1. Projection config marks it as virtual
relations: {
  primaryEmail: {
    property: 'primaryEmail',
    fields: ['id', 'name', 'value', 'channel', 'subType', 'isPrimary'],
    virtual: true,  // ProjectionService will skip this
  },
}

// 2. Repository loads it with filtered JOIN
protected loadPrimaryContacts(qb, alias, types) {
  for (const type of types) {
    const relationAlias = `primary${type.charAt(0).toUpperCase() + type.slice(1)}`;
    qb.leftJoinAndMapOne(
      `${alias}.${relationAlias}`,      // Maps to entity.primaryEmail
      `${alias}.contactMethods`,         // Source relation
      relationAlias,
      `${relationAlias}.channel = :${relationAlias}Channel AND ${relationAlias}.isPrimary = true`,
      { [`${relationAlias}Channel`]: type },
    );
  }
}
```

## Relational Sorting and Filtering

Standard sorting/filtering validates fields against entity decorators (`@Sortable`, `@Filterable`). Virtual/relational fields aren't on the entity, so they require special handling.

### The Problem

```
GET /agents?sort=[{"field":"primaryEmail","direction":"ASC"}]

// Without special handling:
1. QueryService.normalizeWithValidation() checks @Sortable fields on AgentEntity
2. primaryEmail is NOT on the entity (it's a virtual relation)
3. Validation fails with "Invalid sort field: primaryEmail"
```

### The Solution Pattern

Repositories that support relational sorting/filtering must:

1. **Define relational fields in the query config**
2. **Extract relational fields before validation**
3. **Apply custom JOINs in the query**
4. **Skip default sort when relational sort is applied**

### Implementation Checklist

#### Step 1: Define Relational Fields

```typescript
// In repository file
const RELATIONAL_SORT_FIELDS = ['primaryEmail'] as const;
const RELATIONAL_FILTER_FIELDS = ['email', 'country'] as const;

// Add to query config's allowedSortFields/allowedFilterFields
const AGENT_QUERY_CONFIG: BaseQueryConfig = {
  allowedSortFields: [
    'id', 'firstName', 'lastName', // ... entity fields
    'primaryEmail',  // Relational sort field
  ],
  allowedFilterFields: [
    'id', 'firstName', 'lastName', // ... entity fields
    'email', 'country',  // Relational filter fields
  ],
  // ...
};
```

#### Step 2: Extract Relational Fields

The extraction must handle both formats:
- **Raw array format**: `[{field, direction}]` (from JSON.parse of query string)
- **Normalized format**: `{conditions: [{field, direction}]}` (after Zod parsing)

```typescript
private extractRelationalSorts(sort?:
  | Array<{ field: string; direction: 'ASC' | 'DESC' }>
  | { conditions?: Array<{ field: string; direction: 'ASC' | 'DESC' }> }
): {
  primaryEmailSort: { field: string; direction: 'ASC' | 'DESC' } | null;
  standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
} {
  let primaryEmailSort = null;
  const standardConditions = [];

  // Handle both array format (raw) and object format (normalized)
  const conditions = Array.isArray(sort) ? sort : sort?.conditions;

  if (!conditions) {
    return { primaryEmailSort, standardConditions };
  }

  for (const condition of conditions) {
    if (condition.field === 'primaryEmail') {
      primaryEmailSort = condition;
    } else {
      standardConditions.push(condition);
    }
  }

  return { primaryEmailSort, standardConditions };
}
```

#### Step 3: Override findPage()

```typescript
async findPage(query, selection): Promise<PageResult<Agent>> {
  // Parse JSON strings from query params
  const sortObj = typeof query.sort === 'string' ? JSON.parse(query.sort) : query.sort;
  const filterObj = typeof query.filter === 'string' ? JSON.parse(query.filter) : query.filter;

  // Extract relational fields
  const { primaryEmailSort, standardConditions } = this.extractRelationalSorts(sortObj);
  const hasRelationalSort = primaryEmailSort !== null;

  // Build modified query WITHOUT relational fields (for validation)
  const modifiedQuery = { ...query };
  if (hasRelationalSort && sortObj) {
    // Rebuild as raw array format (downstream parses it again)
    modifiedQuery.sort = JSON.stringify(standardConditions);
  }

  // Call findWithQuery with custom query logic
  return this.findWithQuery(modifiedQuery, selection, (qb) => {
    // Apply relational sort with custom JOIN
    if (primaryEmailSort) {
      this.applyPrimaryEmailSort(qb, this.getAlias(), primaryEmailSort);
    }
  }, { skipDefaultSort: hasRelationalSort });  // Prevent default sort override
}
```

#### Step 4: Apply Custom JOIN for Sort

```typescript
private applyPrimaryEmailSort(qb, alias, sortCondition, needsJoin = true) {
  const primaryEmailAlias = 'primaryEmail';

  if (needsJoin) {
    qb.leftJoin(
      `${alias}.contactMethods`,
      primaryEmailAlias,
      `${primaryEmailAlias}.channel = :channel AND ${primaryEmailAlias}.isPrimary = true`,
      { channel: 'email' },
    );
    qb.addSelect(`${primaryEmailAlias}.value`);
  }

  // Use orderBy (not addOrderBy) since this is the primary sort
  qb.orderBy(`${primaryEmailAlias}.value`, sortCondition.direction, 'NULLS LAST');
}
```

### The skipDefaultSort Option

`BaseTypeOrmRepository.findWithQuery()` applies a default sort if no sort is specified. When using relational sorting, you must pass `{ skipDefaultSort: true }` to prevent the default sort from overriding your relational sort.

```typescript
// In IRepository.ts findWithQuery():
if ((!normalized.sort || normalized.sort.conditions.length === 0)
    && config.defaultSort
    && !options?.skipDefaultSort) {  // Skip when relational sort applied
  qb.orderBy(`${alias}.${config.defaultSort.field}`, config.defaultSort.direction);
}
```

### Query Format Handling

Query parameters arrive in different formats at different stages:

| Stage | sort format | Example |
|-------|-------------|---------|
| URL query string | JSON string | `?sort=[{"field":"primaryEmail","direction":"ASC"}]` |
| After JSON.parse | Array | `[{field: "primaryEmail", direction: "ASC"}]` |
| After Zod parsing | Object with conditions | `{conditions: [{field: "primaryEmail", direction: "ASC"}]}` |

The extraction methods must handle the **array format** because they run before Zod parsing. When rebuilding `modifiedQuery.sort`, use `JSON.stringify(array)` to maintain the raw format.

### Current Implementations

| Route | Virtual Relations | Relational Sort | Relational Filter |
|-------|-------------------|-----------------|-------------------|
| `/agents` | primaryEmail, primaryPhone, primaryAddress | primaryEmail | email, country |
| `/offices` | - | - | - |
| `/states` | - | - | - |
| `/mls` | - | - | - |
| `/pay-plans` | - | - | - |

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

3. **Post-Query Loading for Pagination**
   - Relations with high cardinality (1:N with many rows per parent) must **not** be LEFT JOINed
     in `getManyAndCount()` because the JOIN inflates both the data query and the COUNT query.
   - Instead, run the pagination query without the relation, then load the relation data in a
     second query using the page's IDs (`WHERE agent_id = ANY($1)`).
   - This pattern is used for: `contactMethod`, `primaryEmail`, `primaryPhone`, `primaryAddress`,
     `licensedStates`.
   - Relations that are effectively 1:1 with `isPrimary = true` (e.g., `primaryLicense`,
     `primaryAgentCompany`, `primaryTax`) can stay as JOINs because they add at most 1 row per
     agent and don't inflate the COUNT.
   - Relations required for ORDER BY (e.g., `primaryEmail` when sorting) must remain in the main
     query — you can't sort post-query. Use a lightweight `leftJoin` (not `leftJoinAndSelect`)
     for the sort column only.

4. **Query Logging**
   - Log generated SQL for debugging
   - Monitor slow queries (>500ms)
   - Use EXPLAIN ANALYZE for optimization (see Query Performance Monitoring below)

## Query Performance Monitoring (Microscope)

The `QueryPerformanceInterceptor` instruments API requests to capture SQL timing, connection pool
metrics, and optional EXPLAIN ANALYZE plans.

### Environment Variables

Defaults are defined in the Zod schema at `services/agent-service/src/core/configuration.ts`.

| Variable | Default | Description |
|---|---|---|
| `PERF_QUERY_MODE` | `query` | `query` (full), `perf` (timing only), `off` |
| `PERF_QUERY_SLOW_MS` | `2000` | Slow query threshold (ms) |
| `PERF_QUERY_CRITICAL_MS` | `10000` | Critical query threshold (ms) |
| `PERF_QUERY_LOG_ALL` | `false` | Log every instrumented request |
| `PERF_QUERY_INCLUDE_IN_RESPONSE` | `true` | Include SQL and performance metrics in `meta.query.performance` |
| `PERF_QUERY_CAPTURE_EXPLAIN` | `off` | When to run EXPLAIN ANALYZE (see below) |
| `PERF_QUERY_SAMPLE_RATE` | `1.0` | Fraction of requests to instrument |
| `PERF_QUERY_ENDPOINT_ALLOWLIST` | `""` (all) | Comma-separated path prefixes |

### EXPLAIN ANALYZE Modes

| Mode | Fires when | Use case |
|---|---|---|
| `off` | Never | **Production default.** Safe, zero overhead. |
| `slow` | Query > `PERF_QUERY_SLOW_MS` | Temporary diagnosis of slow endpoints |
| `critical` | Query > `PERF_QUERY_CRITICAL_MS` | Catch only severe regressions |
| `all` | Every instrumented request | Local profiling only |

**CAUTION**: `EXPLAIN (ANALYZE)` **re-executes the query**. A 3s slow query triggers a 3s+ EXPLAIN,
doubling response time to 6s+. This can push borderline requests past gateway timeouts.
Only enable `slow` or `critical` temporarily for diagnostics, then set back to `off`.

### What Gets Logged

- **Always** (when `PERF_QUERY_MODE=query`): `durationMs`, `source`, connection pool metrics
- **Slow queries** (> `PERF_QUERY_SLOW_MS`): logged at `operational` level with SQL text
- **Critical queries** (> `PERF_QUERY_CRITICAL_MS`): logged at `critical` level with full SQL
- **EXPLAIN** (when enabled): execution plan, sequential scan detection, row estimate accuracy

### Response Headers

Every instrumented request gets these headers (regardless of `includeInResponse`):

| Header | Example | Description |
|---|---|---|
| `X-Response-Time` | `142ms` | Total response time |
| `X-Query-Timestamp` | `2026-03-04T16:29:52.770Z` | Request timestamp |
| `X-Correlation-ID` | `1709571592770-abc123def` | Correlation ID for log tracing |

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Using leftJoinAndSelect with field selection | Use leftJoin + addSelect |
| Not specifying relation fields | Always configure relation.fields |
| Skipping value coercion | Coerce and validate before SQL |
| No type casting for UUID/BigInt search | Apply ::text cast for LIKE/ILIKE |
| Validating only at database level | Multi-layer validation (service + DB) |
| Sorting on virtual relation fails validation | Extract relational sort before validation, apply custom JOIN |
| Default sort overrides relational sort | Pass `{ skipDefaultSort: true }` to findWithQuery |
| Extraction expects normalized format but receives array | Handle both `[{...}]` and `{conditions: [{...}]}` formats |
