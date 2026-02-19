# Runbook: Adding Virtual Relation Sorting & Filtering

This runbook guides you through adding sorting and filtering on virtual/relational fields to an existing route.

## Prerequisites

Before starting:
1. Read `docs/architecture/query-system.md` (especially "Relational Sorting and Filtering" section)
2. Understand what virtual relations are and why they need special handling
3. Have a working route with standard sorting/filtering already implemented

## When to Use This Runbook

Use this when you need to:
- Sort by a field from a related entity (e.g., sort agents by `primaryEmail`)
- Filter by a field from a related entity (e.g., filter agents by `email` in contactMethods)
- Sort/filter by computed or aggregated values (e.g., sort by `licensedStates` state code)

## The Problem

Virtual relations aren't columns on the base entity, so:
1. Standard validation checks `@Sortable`/`@Filterable` decorators on the entity
2. Virtual fields don't have these decorators
3. Validation fails with "Invalid sort/filter field"

## Architecture Reference

See `docs/architecture/query-system.md` for detailed architectural explanation of:
- Virtual relation concepts
- Extraction pattern
- Query format handling
- The `skipDefaultSort` option

---

## Step-by-Step Implementation

### Step 1: Define Constants for Relational Fields

Add constants at the top of your repository file to track which fields are relational:

```typescript
// modules/{entity}/{entity}.repository.ts

/**
 * Relational filter fields that require custom JOIN handling.
 * These are extracted from filter conditions and applied separately.
 */
const RELATIONAL_FILTER_FIELDS = ['email', 'country'] as const;

/**
 * Relational sort fields that require custom JOIN handling.
 * These are extracted from sort conditions and applied separately.
 */
const RELATIONAL_SORT_FIELDS = ['primaryEmail'] as const;
```

### Step 2: Add Relational Fields to Query Config

Include the relational fields in `allowedSortFields` or `allowedFilterFields`:

```typescript
const MY_ENTITY_QUERY_CONFIG: BaseQueryConfig = {
  allowedSortFields: [
    'id', 'name', 'created', // ... standard entity fields
    // Relational sort fields (handled specially in findPage)
    'primaryEmail',
  ],
  allowedFilterFields: [
    'id', 'name', 'status', // ... standard entity fields
    // Relational filter fields (handled specially in findPage)
    'email', 'country',
  ],
  // ...
};
```

### Step 3: Create Extraction Methods

Add methods to extract relational fields from query params. Must handle both array and object formats:

**For Sorting:**
```typescript
/**
 * Extract relational sort conditions from the query sort.
 * Returns the extracted conditions and the remaining standard conditions.
 */
private extractRelationalSorts(sort?:
  | Array<{ field: string; direction: 'ASC' | 'DESC' }>
  | { conditions?: Array<{ field: string; direction: 'ASC' | 'DESC' }> }
): {
  primaryEmailSort: { field: string; direction: 'ASC' | 'DESC' } | null;
  standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
} {
  let primaryEmailSort: { field: string; direction: 'ASC' | 'DESC' } | null = null;
  const standardConditions: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];

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

**For Filtering:**
```typescript
/**
 * Extract relational filter conditions from the query filter.
 */
private extractRelationalFilters(filter?:
  | Array<{ field: string; operator: string; value: any }>
  | { conditions?: Array<{ field: string; operator: string; value: any }>; logicalOperator?: string }
): {
  emailFilters: Array<{ field: string; operator: string; value: any }>;
  standardConditions: Array<{ field: string; operator: string; value: any }>;
} {
  const emailFilters: Array<{ field: string; operator: string; value: any }> = [];
  const standardConditions: Array<{ field: string; operator: string; value: any }> = [];

  const conditions = Array.isArray(filter) ? filter : filter?.conditions;

  if (!conditions) {
    return { emailFilters, standardConditions };
  }

  for (const condition of conditions) {
    if (condition.field === 'email') {
      emailFilters.push(condition);
    } else {
      standardConditions.push(condition);
    }
  }

  return { emailFilters, standardConditions };
}
```

### Step 4: Create Apply Methods

Create methods that add the JOINs and WHERE/ORDER BY clauses:

**For Sorting:**
```typescript
/**
 * Apply primaryEmail sort to the query builder.
 * Ensures primaryEmail is joined and sorts by the value field.
 */
private applyPrimaryEmailSort<T>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  sortCondition: { field: string; direction: 'ASC' | 'DESC' },
  needsJoin: boolean,
): void {
  const primaryEmailAlias = 'primaryEmail';

  // Only add join if not already joined via include
  if (needsJoin) {
    qb.leftJoin(
      `${alias}.contactMethods`,
      primaryEmailAlias,
      `${primaryEmailAlias}.channel = :primaryEmailSortChannel AND ${primaryEmailAlias}.isPrimary = true`,
      { primaryEmailSortChannel: 'email' },
    );
    // Select the value field for sorting
    qb.addSelect(`${primaryEmailAlias}.value`);
  }

  // Apply the sort - use orderBy since this is the primary requested sort
  qb.orderBy(`${primaryEmailAlias}.value`, sortCondition.direction, 'NULLS LAST');
}
```

**For Filtering:**
```typescript
/**
 * Apply email filter conditions to the query builder.
 */
private applyEmailFilters<T>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  filters: Array<{ field: string; operator: string; value: any }>,
): void {
  if (filters.length === 0) return;

  const emailAlias = 'emailFilter';

  // Join contactMethods for email filtering
  qb.leftJoin(
    `${alias}.contactMethods`,
    emailAlias,
    `${emailAlias}.channel = :emailFilterChannel`,
    { emailFilterChannel: 'email' },
  );

  // Apply each email filter condition
  filters.forEach((condition, index) => {
    const paramName = `emailFilter_${index}`;
    this.applyRelationalFilterCondition(qb, `${emailAlias}.value`, condition, paramName);
  });
}
```

### Step 5: Wire Up in findPage()

Update your `findPage()` method to use the extraction and apply methods:

```typescript
async findPage(
  query: Partial<QueryParams>,
  selection?: FieldSelection,
): Promise<PageResult<MyEntity>> {
  // Parse JSON strings from query params
  const sortObj = typeof query.sort === 'string' ? JSON.parse(query.sort) : query.sort;
  const filterObj = typeof query.filter === 'string' ? JSON.parse(query.filter) : query.filter;

  // Extract relational fields
  const { primaryEmailSort, standardConditions: standardSortConditions } =
    this.extractRelationalSorts(sortObj);
  const { emailFilters, standardConditions: standardFilterConditions } =
    this.extractRelationalFilters(filterObj);

  // Check if we have any relational operations
  const hasRelationalSort = primaryEmailSort !== null;
  const hasRelationalFilters = emailFilters.length > 0;
  const needsCustomQuery = hasRelationalSort || hasRelationalFilters;

  // Build modified query params without relational fields
  const modifiedQuery: Partial<QueryParams> = { ...query };
  if (hasRelationalFilters && filterObj) {
    modifiedQuery.filter = JSON.stringify(standardFilterConditions) as any;
  }
  if (hasRelationalSort && sortObj) {
    modifiedQuery.sort = JSON.stringify(standardSortConditions) as any;
  }

  if (needsCustomQuery) {
    // Check if primaryEmail is already being included (so we don't double-join)
    const primaryEmailIncluded = selection?.include?.includes('primaryEmail');

    return this.findWithQuery(modifiedQuery, selection, (qb) => {
      // Apply relational filters
      if (emailFilters.length > 0) {
        this.applyEmailFilters(qb, this.getAlias(), emailFilters);
      }

      // Apply relational sort
      if (primaryEmailSort) {
        this.applyPrimaryEmailSort(
          qb,
          this.getAlias(),
          primaryEmailSort,
          !primaryEmailIncluded, // needsJoin = true only if not already joined
        );
      }
    }, { skipDefaultSort: hasRelationalSort }); // CRITICAL: Skip default sort!
  }

  return this.findWithQuery(modifiedQuery, selection);
}
```

---

## Key Points to Remember

### 1. Handle Both Query Formats

Query params arrive in different formats:
- **Raw from URL**: `[{field, direction}]` (array)
- **After Zod parsing**: `{conditions: [{field, direction}]}` (object)

Always handle both in extraction methods:
```typescript
const conditions = Array.isArray(sort) ? sort : sort?.conditions;
```

### 2. Use `skipDefaultSort` for Relational Sorts

When applying a relational sort, pass `{ skipDefaultSort: true }` to prevent the base repository from adding a default sort that overrides yours.

### 3. Avoid Double JOINs

If the virtual relation is already loaded via `?include=`, don't JOIN again:
```typescript
const primaryEmailIncluded = selection?.include?.includes('primaryEmail');
// ...
if (primaryEmailSort) {
  this.applyPrimaryEmailSort(qb, alias, primaryEmailSort, !primaryEmailIncluded);
}
```

### 4. Use Unique Aliases

When adding multiple JOINs for different purposes, use unique aliases:
- `emailFilter` for email filtering
- `primaryEmail` for primaryEmail include
- `emailSearchAlias` for email searching

### 5. Rebuild Modified Query as JSON String

After extracting relational fields, rebuild the modified query as a JSON string (the downstream code will parse it again):
```typescript
modifiedQuery.sort = JSON.stringify(standardConditions) as any;
```

---

## Current Implementations Reference

| Route | Relational Sorts | Relational Filters |
|-------|-----------------|-------------------|
| `/agents` | `primaryEmail`, `licensedStates` | `email`, `country`, `licensedStates` |
| `/offices` | - | - |
| `/states` | - | - |

---

## Testing Checklist

- [ ] Sort by relational field ASC works
- [ ] Sort by relational field DESC works
- [ ] Sort by relational field with NULLS LAST works
- [ ] Filter by relational field works
- [ ] Combining relational sort with standard sort works
- [ ] Combining relational filter with standard filter works
- [ ] Using `include=` with the same field doesn't cause duplicate JOINs
- [ ] Validation doesn't reject the relational field

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid sort field: X" | Field not in `allowedSortFields` | Add to query config |
| Sort has no effect | Default sort overrides | Pass `{ skipDefaultSort: true }` |
| Duplicate JOINs | Both include and sort join the same table | Check if already included before joining |
| Empty results | Filter condition too restrictive | Check JOIN conditions and WHERE clauses |
| "Cannot read property 'conditions'" | Not handling array format | Use `Array.isArray(sort) ? sort : sort?.conditions` |

---

## Related Documentation

- **Architecture**: `docs/architecture/query-system.md` - Full architectural details
- **Repository Patterns**: `docs/architecture/repository-patterns.md` - Base repository implementation
- **Adding Routes**: `docs/runbooks/adding-new-route.md` - Basic route creation
