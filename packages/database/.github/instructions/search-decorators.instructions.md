```instructions
---
applyTo: "**/decorators/*.ts, **/entities/**/*.ts"
---

# Search Decorator Instructions

You are an expert in applying search, filter, and sort decorators for the @exprealty/database package. These decorators enable type-safe querying with automatic validation.

## Overview

The package provides three main decorators for queryable fields:
- `@Searchable` - Enables text search via `?search=term`
- `@Filterable` - Enables filtering via `?filter=field:op:value`
- `@Sortable` - Enables sorting via `?sort=field:direction`

All decorators are defined in `src/decorators/searchable-decorators.ts`.

## @Searchable Decorator

### Basic Usage

```typescript
@Column({ name: 'first_name', type: 'text' })
@Searchable({ 
  weight: 10,           // Relevance weight 1-10 (higher = more relevant)
  behavior: 'partial',  // 'partial' for ILIKE %term%, 'exact' for =
  description: 'Agent first name'
})
firstName!: string
```

### Weight Guidelines

| Weight | Use Case | Example Fields |
|--------|----------|----------------|
| 10 | Primary identifiers, names | firstName, lastName |
| 8-9 | Secondary identifiers | email, preferredName |
| 6-7 | Important text fields | bio, company name |
| 4-5 | Reference IDs | agentId, officeId |
| 2-3 | Metadata fields | status, type |
| 1 | Low-priority fields | internal codes |

### Behavior Types

- `'partial'` - Uses ILIKE '%term%' for substring matching
- `'exact'` - Uses = for exact matching
- `'range'` - For date/numeric fields that support range queries

### Type-Specific Validation

Always add validators for numeric and special types:

```typescript
// BigInt fields - prevent PostgreSQL overflow
@Column({ name: 'agent_id', type: 'bigint' })
@Searchable({ 
  type: 'integer',
  weight: 4, 
  behavior: 'exact',
  description: 'Agent ID (bigint)',
  validate: SearchValidators.bigint  // Validates -9223372036854775808 to 9223372036854775807
})
agentId!: string

// Integer fields - prevent overflow
@Column({ type: 'integer' })
@Searchable({ 
  type: 'integer',
  weight: 3, 
  behavior: 'exact',
  validate: SearchValidators.integer  // Validates -2147483648 to 2147483647
})
count!: number

// Date fields
@Column({ type: 'timestamp with time zone' })
@Searchable({ 
  type: 'date',
  weight: 3, 
  behavior: 'range',
  description: 'Creation date'
})
created!: Date

// Boolean fields
@Column({ type: 'boolean' })
@Searchable({ 
  type: 'boolean',
  weight: 5, 
  behavior: 'exact',
  description: 'Active status'
})
isActive!: boolean
```

### SearchValidators

Available validators in `SearchValidators`:

| Validator | Purpose | Range |
|-----------|---------|-------|
| `bigint` | PostgreSQL bigint | ±9.2 quintillion |
| `integer` | PostgreSQL integer | ±2.1 billion |
| `positive` | Positive numbers only | > 0 |
| `range(min, max)` | Custom numeric range | User-defined |
| `fromOptions({...})` | Full validation options | See below |

### SearchValidationOptions (Full Options)

Use `SearchValidators.fromOptions()` for complete control over validation:

```typescript
interface SearchValidationOptions {
  min?: number | Date;       // Minimum value (numeric/date)
  max?: number | Date;       // Maximum value (numeric/date)
  minLength?: number;        // Minimum string length
  maxLength?: number;        // Maximum string length
  pattern?: RegExp;          // Regex pattern validation
  enum?: any[];              // Allowed values list
  transform?: (value: any) => any;  // Transform before validation
  custom?: SearchValidator;  // Custom validator function
  errorMessage?: string;     // Custom error message (overrides default)
}
```

### Complete Example with All Options

```typescript
// Price field with min/max and custom error message
@Column({ name: 'list_price', type: 'numeric', precision: 12, scale: 2 })
@Searchable({
  type: 'numeric',
  weight: 7,
  behavior: 'range',
  description: 'Property listing price',
  validate: SearchValidators.fromOptions({
    min: 0,
    max: 1000000000,  // 1 billion max
    errorMessage: 'Price must be between $0 and $1,000,000,000'
  })
})
@Filterable()
@Sortable()
listPrice!: number

// Year field with realistic range
@Column({ name: 'year_built', type: 'integer' })
@Searchable({
  type: 'integer',
  weight: 4,
  behavior: 'exact',
  description: 'Year property was built',
  validate: SearchValidators.fromOptions({
    min: 1800,
    max: new Date().getFullYear() + 5,  // Allow future dates for planned construction
    errorMessage: 'Year must be between 1800 and current year + 5'
  })
})
@Filterable()
@Sortable()
yearBuilt!: number

// Status field with enum validation
@Column({ type: 'text' })
@Searchable({
  weight: 6,
  behavior: 'exact',
  description: 'Agent lifecycle status',
  validate: SearchValidators.fromOptions({
    enum: ['active', 'inactive', 'pending', 'terminated'],
    errorMessage: 'Status must be one of: active, inactive, pending, terminated'
  })
})
@Filterable()
@Sortable()
status!: string

// Email field with pattern and length validation
@Column({ type: 'text' })
@Searchable({
  weight: 8,
  behavior: 'partial',
  description: 'Agent email address',
  validate: SearchValidators.fromOptions({
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255,
    errorMessage: 'Invalid email format'
  })
})
@Filterable()
email!: string

// Field with transform (normalize before validation)
@Column({ name: 'phone_number', type: 'text' })
@Searchable({
  weight: 6,
  behavior: 'partial',
  description: 'Agent phone number',
  validate: SearchValidators.fromOptions({
    transform: (value) => value.replace(/[\s\-\(\)]/g, ''),  // Strip formatting
    pattern: /^\+?[0-9]{10,15}$/,
    errorMessage: 'Phone must be 10-15 digits'
  })
})
phone!: string

// Custom validator for complex logic
@Column({ name: 'commission_rate', type: 'numeric', precision: 5, scale: 4 })
@Searchable({
  type: 'numeric',
  weight: 5,
  behavior: 'exact',
  description: 'Commission rate (0.0000 to 1.0000)',
  validate: (value, field, fieldType) => {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: true };  // Let text pass through
    if (num < 0 || num > 1) {
      return { 
        valid: false, 
        error: `Commission rate must be between 0 and 1 (got ${num})` 
      };
    }
    return { valid: true, sanitized: num };
  }
})
commissionRate!: number
```

### Using Custom Range Validator

For simple numeric ranges, use the shorthand:

```typescript
@Column({ type: 'integer' })
@Searchable({
  type: 'integer',
  weight: 4,
  behavior: 'exact',
  description: 'Number of bedrooms',
  validate: SearchValidators.range(0, 50)  // 0-50 bedrooms
})
bedrooms!: number
```

## @Filterable Decorator

Enables field filtering with various operators:

```typescript
@Column({ type: 'text' })
@Filterable()  // Default operators: eq, ne, contains, startsWith, endsWith
lifecycleStatus!: string

@Column({ type: 'integer' })
@Filterable()  // For numbers: eq, ne, gt, gte, lt, lte, between
amount!: number

@Column({ type: 'timestamp with time zone' })
@Filterable()  // For dates: eq, ne, gt, gte, lt, lte, between
createdAt!: Date
```

### Filter Query Examples

```
?filter=status:eq:active
?filter=amount:gte:1000
?filter=createdAt:between:2024-01-01,2024-12-31
?filter=firstName:contains:john
```

## @Sortable Decorator

Enables field sorting:

```typescript
@Column({ name: 'last_name', type: 'text' })
@Sortable()  // Enables ?sort=lastName:asc or ?sort=lastName:desc
lastName!: string
```

### Sort Query Examples

```
?sort=lastName:asc
?sort=createdAt:desc
?sort=firstName:asc,lastName:asc  // Multi-field sort
```

## Composite Decorator Pattern

Most queryable fields use all three decorators:

```typescript
@Column({ name: 'first_name', type: 'text' })
@Searchable({ weight: 10, behavior: 'partial', description: 'First name' })
@Filterable()
@Sortable()
firstName!: string
```

## Primary Key Pattern

Primary keys are always searchable and filterable:

```typescript
@PrimaryGeneratedColumn('uuid')
@Searchable({ weight: 3, behavior: 'exact', description: 'Unique identifier (UUID)' })
@Filterable()
@Sortable()
id!: string
```

## Foreign Key Pattern

Foreign keys should be searchable with appropriate type:

```typescript
// UUID foreign key
@Column({ name: 'agent_id', type: 'uuid' })
@Searchable({ weight: 4, behavior: 'exact', description: 'Agent ID reference (UUID)' })
@Filterable()
@Sortable()
agentId!: string

// BigInt foreign key (legacy only)
@Column({ name: 'office_id', type: 'bigint' })
@Searchable({ 
  type: 'integer', 
  weight: 4, 
  behavior: 'exact', 
  description: 'Office ID reference (bigint)',
  validate: SearchValidators.bigint 
})
@Filterable()
@Sortable()
officeId!: string
```

## Critical Rules

1. **ALWAYS validate numeric fields** with appropriate SearchValidator
2. **MATCH type property** with actual column type (integer, date, boolean)
3. **SET meaningful weights** based on field importance for search
4. **INCLUDE description** for API documentation
5. **USE partial behavior** for text fields users might search partially
6. **USE exact behavior** for IDs, codes, and enum-like fields
7. **ADD @Filterable** for fields users will filter on
8. **ADD @Sortable** for fields users will sort by
9. **CONSIDER performance** - indexed fields should be filterable/sortable
```
