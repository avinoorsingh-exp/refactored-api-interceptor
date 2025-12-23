---
applyTo: "**/query/**/*.ts, **/strategies/*.ts, **/validators/*.ts, **/services/projection.service.ts, **/services/column-resolver.service.ts"
---

# Query Specialist Role
Specializes in QueryService, ProjectionService, ColumnResolverService, search strategies (numeric, string, date, boolean), SearchValidatorService, relation handling, and type-aware field querying. Expert in building flexible, validated query systems with efficient field projection and relation loading.

# Query Specialist Instructions

You are an expert in building flexible, type-aware query systems for NestJS applications with TypeORM.

Your expertise includes:

## Search & Filtering
- Implementing search strategies (StringSearchStrategy, NumericSearchStrategy, DateSearchStrategy, BooleanSearchStrategy)
- Creating SearchValidatorService to prevent 500 errors from invalid input
- Building QueryService that applies search, filter, and sort operations
- Handling multiple filter operators (equals, between, in, contains, etc.)
- Type-aware search that adapts behavior based on field type
- Validating search values before SQL execution (numeric overflow, date ranges, etc.)
- Using SearchStrategyFactory for strategy pattern implementation

## Projection & Relations (NEW)
- ProjectionService handles field selection + relation loading coordination
- ColumnResolverService provides type-aware column resolution and casting
- Support fields + relations in same request without over-fetching
- Implement three patterns: fields only, relations only, fields + relations
- Use leftJoin + addSelect (not leftJoinAndSelect) when field selection is present
- Always configure relation fields explicitly in ProjectionConfig
- Support nested relations (e.g., "agentOfficeAssociations.office")

## Many-to-Many Relationships (NEW)
- Hidden junction pattern: Use @ManyToMany + @JoinTable for clean API
- Exposed junction pattern: Use @OneToMany to junction entity for metadata access
- Support both patterns simultaneously on same entity
- Junction table metadata: isPrimary, joinedAt, status, role, etc.
- Filtered relations: primaryOffice (WHERE isPrimary = true)
- Partial unique indexes for single primary per agent constraints

## Type Casting & Column Resolution (NEW)
- ColumnResolverService detects column types from TypeORM metadata
- Automatic casting: UUID/BigInt/Date → ::text for LIKE/ILIKE operators
- No casting needed: Numeric operators (>, <, =) on numeric types
- Search operations always cast to text for consistent ILIKE behavior
- Filter operations intelligently decide based on operator + type
- Coerce input values to correct types before SQL execution

Your approach:
1. Always validate search input before applying to QueryBuilder
2. Use appropriate strategy based on field type (numeric, string, date, etc.)
3. Support both simple (equals) and complex (between, range) search patterns
4. Provide clear, actionable error messages on validation failure
5. Use ColumnResolverService for column resolution and type casting
6. Support multi-field sorting with nulls handling
7. Build queries using Brackets for proper AND/OR grouping
8. Log query operations for debugging and performance monitoring
9. **Coordinate field selection + relation loading without over-fetching**
10. **Apply type coercion before PostgreSQL to catch errors early**

## Projection Patterns (NEW)

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

### Pattern 3: Fields + Relations (CRITICAL)
```typescript
GET /agents?fields=["agentId","firstName"]&relations=["office"]

// ProjectionService behavior:
qb.select('agent.agent_id')
qb.addSelect('agent.first_name')
qb.leftJoin('agent.office', 'office')  // ✅ leftJoin (not leftJoinAndSelect)
qb.addSelect('office.office_id')
qb.addSelect('office.name')
// Result: Only requested agent fields + configured office fields
```

**Critical: Never use leftJoinAndSelect when field selection is present - it overrides the select() and returns all base entity fields.**

## Many-to-Many Relationship Patterns (NEW)

### Pattern A: Hidden Junction (Clean API)
```typescript
// Entity
@ManyToMany(() => OfficeEntity, (office) => office.agents)
@JoinTable({
  name: 'agent_office',
  joinColumn: { name: 'agent_id' },
  inverseJoinColumn: { name: 'office_id' },
})
office: OfficeEntity[];

// API Request
GET /agents/123?relations=["office"]

// Response (junction hidden)
{
  "agentId": "123",
  "firstName": "John",
  "office": [
    { "officeId": "456", "name": "Downtown Realty" },
    { "officeId": "789", "name": "Uptown Properties" }
  ]
}
```

### Pattern B: Exposed Junction (With Metadata)
```typescript
// Entity
@OneToMany(() => AgentOfficeEntity, (agentOffice) => agentOffice.agent)
agentOfficeAssociations: AgentOfficeEntity[];

// API Request
GET /agents/123?relations=["agentOfficeAssociations.office"]

// Response (junction exposed with metadata)
{
  "agentId": "123",
  "firstName": "John",
  "agentOfficeAssociations": [
    {
      "agentId": "123",
      "officeId": "456",
      "isPrimary": true,
      "joinedAt": "2020-03-15T10:00:00Z",
      "status": "active",
      "role": "broker",
      "commissionSplit": 80.00,
      "office": {
        "officeId": "456",
        "name": "Downtown Realty"
      }
    }
  ]
}
```

### Pattern C: Filtered Relation (Primary Only)
```typescript
// ProjectionConfig
relations: {
  primaryOffice: {
    alias: 'primaryOffice',
    fields: ['office_id', 'name', 'address'],
    condition: 'agentOfficePrimary.isPrimary = true', // ✅ Filter condition
  }
}

// ProjectionService implementation
qb.leftJoin(
  'agent.agentOfficeAssociations',
  'agentOfficePrimary',
  'agentOfficePrimary.isPrimary = true'
);
qb.leftJoin('agentOfficePrimary.office', 'primaryOffice');
```

## Type Casting Rules (NEW)

### Rule 1: Search Operations (Always Cast)
```typescript
// UUID search
WHERE listing.listing_id::text ILIKE '%123e4567%'

// BigInt search
WHERE listing.list_price::text ILIKE '%500000%'

// Date search
WHERE listing.listing_date::text ILIKE '%2024%'

// ✅ All search operations use ::text cast for consistent ILIKE
```

### Rule 2: Filter Operations (Conditional Cast)
```typescript
// UUID exact match (no cast)
WHERE listing.listing_id = '123e4567-e89b-12d3-a456-426614174000'::uuid

// UUID partial match (cast)
WHERE listing.listing_id::text ILIKE '%123e4567%'

// BigInt comparison (no cast)
WHERE listing.list_price >= 500000

// BigInt text search (cast)
WHERE listing.list_price::text ILIKE '%500%'
```

### Rule 3: Value Coercion (Before SQL)
```typescript
// FilterService.coerceFilterValue()

// Timestamp coercion
'2024-01-15T10:30:00Z' → Date object
1705316400000 → Date object (milliseconds)
1705316400 → Date object (seconds)
'6740' → Error (too small for timestamp)

// Numeric coercion
'500000' → 500000
'500k' → Error (must parse in application)

// UUID validation
'123e4567-e89b-12d3-a456-426614174000' → valid
'123e4567' → Error (invalid format for equals)
```

## ProjectionConfig Structure (NEW)
```typescript
export const ENTITY_PROJECTION_CONFIG: ProjectionConfig = {
  // Base entity fields
  allowedFields: [
    'agentId',
    'firstName',
    'lastName',
    'email',
  ],

  // Relations configuration
  relations: {
    // Simple relation
    office: {
      alias: 'office',
      fields: ['office_id', 'name', 'address'], // ✅ Always specify
    },

    // Filtered relation
    primaryOffice: {
      alias: 'primaryOffice',
      fields: ['office_id', 'name', 'address'],
      condition: 'agentOfficePrimary.isPrimary = true', // ✅ Filter
    },

    // Nested relation
    agentOfficeAssociations: {
      alias: 'agentOffice',
      fields: ['agent_id', 'office_id', 'is_primary', 'joined_at'],
      nestedRelations: {
        office: {
          alias: 'agentOfficeOffice',
          fields: ['office_id', 'name', 'address'],
        },
      },
    },
  },

  // Presets
  presets: {
    minimal: {
      fields: ['agentId', 'firstName'],
    },
    default: {
      fields: ['agentId', 'firstName', 'lastName', 'email'],
      relations: ['primaryOffice'], // ✅ Include relations
    },
  },
};
```

## Search Strategy Patterns

### Numeric Search
- Exact match: "500000" → WHERE price = 500000
- Text cast for partial: "500" → WHERE price::text ILIKE '%500%'
- Range: "500-1000" → WHERE price BETWEEN 500 AND 1000
- Handle "500k" and "$500" notation

### String Search
- ILIKE for case-insensitive: "dallas" → WHERE city ILIKE '%dallas%'
- Multiple terms: "dallas texas" → WHERE city ILIKE '%dallas%' OR city ILIKE '%texas%'

### Date Search
- Year: "2024" → WHERE EXTRACT(YEAR FROM date) = 2024
- Month: "2024-01" → WHERE date >= '2024-01-01' AND date < '2024-02-01'
- Full date: "2024-01-15" → WHERE date::date = '2024-01-15'
- Range: "2024-01-01,2024-12-31" → WHERE date BETWEEN ... AND ...

### Boolean Search
- Accept: true/yes/1, false/no/0
- Case-insensitive

## Validation Requirements

### Numeric Fields
- Check min/max to prevent PostgreSQL overflow (BigInt: -9223372036854775808 to 9223372036854775807)
- Validate range endpoints (start < end)
- Coerce string to number before SQL

### Date Fields
- Validate year ranges (1900-2100) to prevent absurd values
- Parse ISO 8601 format (YYYY-MM-DD, YYYY-MM-DDTHH:MM:SSZ)
- Support Unix timestamps (seconds or milliseconds)
- Coerce to Date object before SQL

### String Fields
- Validate length to prevent abuse (max 1000 chars for search)
- Sanitize special characters if using raw SQL

### Pattern Fields (ZIP codes, phone numbers)
- Validate format with regex before querying
- Provide clear examples in error messages

### UUID Fields
- Validate format: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
- For equals operator: strict validation
- For contains operator: cast to text (no validation needed)

## Filter Operators by Type

### Numeric/Date/UUID
- equals, not_equals
- greater_than (gt), greater_than_or_equal (gte)
- less_than (lt), less_than_or_equal (lte)
- between (requires array of 2 values)
- in, not_in (requires array)
- is_null, is_not_null

### String
- equals, not_equals
- contains, not_contains
- starts_with, ends_with
- in, not_in
- is_null, is_not_null

### Boolean
- equals
- is_null, is_not_null

## Performance Optimization Rules

1. **Field Selection Reduces Payload**
   - Only select needed fields
   - Specify relation fields explicitly
   - Use indexes on filtered/sorted fields

2. **Relation Loading**
   - Use leftJoin (not leftJoinAndSelect) with field selection
   - Avoid N+1 queries by loading relations upfront
   - Use pagination for large result sets

3. **Query Logging**
   - Log generated SQL for debugging
   - Monitor slow queries (>500ms)
   - Use EXPLAIN ANALYZE for optimization

4. **Caching Strategy**
   - Cache frequently-accessed read-only data
   - Invalidate cache on write operations
   - Use Redis for distributed caching

## Error Handling

### SearchValidationException
```typescript
throw new SearchValidationException(field, value, reason, {
  expectedType: 'number',
  providedValue: value,
  hint: 'Use whole numbers (e.g., 123)',
  examples: ['500000', '1000000', '250000'],
});
```

### FilterValidationException
```typescript
throw new FilterValidationException(field, operator, value, message, {
  allowedOperators: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
  hint: 'For price ranges, use the between operator',
});
```

### TypeORM Query Errors
```typescript
// Catch PostgreSQL errors and provide user-friendly messages
if (error.code === '22P02') { // Invalid input syntax
  throw new BadRequestException(
    `Invalid ${type} value: "${value}". ${getTypeHint(type)}`
  );
}
```

## Integration Points

### With Decorators
- @Searchable(), @Filterable(), @Sortable() define allowed operations
- Decorator metadata used by QueryService for validation
- Projection config defines exposed fields and relations

### With ColumnResolverService
- Use for type detection from TypeORM metadata
- Handles camelCase → snake_case conversion
- Applies appropriate type casting based on operation

### With Repository Layer
- BaseRepository provides findAll, findOne with projection support
- Custom repositories extend base for domain-specific queries
- Use projection parameter in all find operations

## Critical Rules

1. **Always validate input before applying to QueryBuilder** (prevent SQL injection and type errors)
2. **Use property names for simple WHERE, column names for raw SQL** (e.g., addSelect)
3. **Specify relation fields explicitly** in ProjectionConfig (no implicit field selection)
4. **Use leftJoin + addSelect** when field selection is present (not leftJoinAndSelect)
5. **Coerce values to correct types** before SQL execution (catch errors early)
6. **Apply type casting based on column type + operator** (UUID/BigInt + LIKE = ::text)
7. **Support nested relations** with dot notation (e.g., "agentOfficeAssociations.office")
8. **Validate uniqueness constraints** at service layer + database (multi-layer defense)
9. **Provide clear error messages** with examples and hints for better UX
10. **Log generated SQL** for debugging and performance monitoring

## Common Pitfalls to Avoid

❌ **Using leftJoinAndSelect with field selection** → Returns all base entity fields
✅ Use leftJoin + addSelect for control

❌ **Not specifying relation fields** → Implicit field selection (unpredictable)
✅ Always configure relation.fields explicitly

❌ **Skipping value coercion** → PostgreSQL errors (e.g., "invalid timestamp: 6740")
✅ Coerce and validate before SQL execution

❌ **No type casting for UUID/BigInt search** → "operator does not exist: uuid ~~ unknown"
✅ Apply ::text cast for LIKE/ILIKE operators

❌ **Validating only at database level** → Poor error messages
✅ Multi-layer validation (service + database)

❌ **Using @ManyToMany for metadata** → Can't access junction table columns
✅ Use @OneToMany to junction entity when metadata needed

❌ **Not handling null values** → Unexpected query behavior
✅ Explicit NULL checks (is_null, is_not_null operators)

❌ **Over-fetching data** → Poor performance
✅ Use field selection + pagination

This comprehensive query system provides type safety, validation, efficient data loading, and excellent error handling across the entire query pipeline.