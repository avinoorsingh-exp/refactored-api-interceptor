# Pagination and Query Standards

## Overview

This document defines the standards for pagination, filtering, sorting, and search across all API endpoints in the Agent Service platform. These standards ensure consistent behavior and a unified developer experience.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Pagination](#pagination)
3. [Filtering](#filtering)
4. [Sorting](#sorting)
5. [Search](#search)
6. [Entity Decorators](#entity-decorators)
7. [Response Format](#response-format)
8. [Implementation Guide](#implementation-guide)
9. [API Examples](#api-examples)

---

## Architecture

### Layered Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Controller Layer                        │
│   • Receives raw query params via @Query()                 │
│   • Uses PaginationInterceptor for response formatting     │
│   • Returns { items: T[], total: number }                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                           │
│   • Business logic & orchestration                          │
│   • Passes query params to repository                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                         │
│   • Uses QueryService for normalization & validation       │
│   • Applies filters, sorting, search via TypeORM QB        │
│   • Returns PageResult<T> = { items: T[], total: number }  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Query Infrastructure                       │
│   QueryService (agent-service)                              │
│   • normalizeWithValidation() - validates against entity   │
│   • applyFilters(), applySorting(), applySearch()         │
│   • applyAll() - combines all operations                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Shared Domain (packages/shared-domain)         │
│   Schemas: QueryParamsSchema, FilterSchema, SortSchema     │
│   Types: Filter, Sort, FilterCondition, FilterOperator     │
│   Constants: LIMIT_DEFAULT=25, LIMIT_MAX=50                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Database Package (packages/database)           │
│   Decorators: @Searchable, @Filterable, @Sortable          │
│   Helpers: getSearchableFields(), getFilterableFields()    │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Package | Purpose |
|-----------|---------|---------|
| `QueryService` | `agent-service` | Query normalization and TypeORM integration |
| `PaginationService` | `agent-service` | Metadata calculation and header generation |
| `PaginationInterceptor` | `agent-service` | Response envelope and header injection |
| `QueryParamsSchema` | `shared-domain` | Zod schema for query validation |
| `FilterSchema` | `shared-domain` | Filter condition validation |
| `SortSchema` | `shared-domain` | Sort condition validation |
| Entity Decorators | `database` | Field-level capability markers |

---

## Pagination

### Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `LIMIT_DEFAULT` | 25 | Default page size when not specified |
| `LIMIT_MAX` | 50 | Maximum allowed page size |
| `OFFSET_DEFAULT` | 0 | Default starting position |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | 0 | Number of items to skip (0-indexed) |
| `limit` | integer | 25 | Maximum items to return (1-50) |

### Pagination Metadata

The response includes pagination metadata:

```typescript
interface PaginationMeta {
  total: number;        // Total count of items matching query
  totalPages: number;   // Calculated total pages
  currentPage: number;  // Current page number (1-indexed)
  limit: number;        // Items per page
  offset: number;       // Current offset
  hasNext: boolean;     // More items available
  hasPrev: boolean;     // Previous items available
}
```

### HTTP Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-Total-Count` | Total number of matching items | `157` |
| `Link` | RFC 8288 pagination links | `<url>; rel="next", <url>; rel="prev"` |

### Link Header Relations

| Relation | Description |
|----------|-------------|
| `next` | URL for next page (if `hasNext`) |
| `prev` | URL for previous page (if `hasPrev`) |
| `first` | URL for first page |
| `last` | URL for last page |

---

## Filtering

### JSON Filter Syntax

Filters use a JSON object with `conditions` array and `logicalOperator`:

```
GET /v1/states?filter={"conditions":[{"field":"isActive","operator":"eq","value":true}],"logicalOperator":"AND"}
```

### Multiple Conditions

Multiple conditions are combined within the `conditions` array:

```
GET /v1/states?filter={"conditions":[{"field":"isActive","operator":"eq","value":true},{"field":"code","operator":"in","value":["CA","TX","FL"]}],"logicalOperator":"AND"}
```

### Supported Operators

| Operator | Description | Example Value |
|----------|-------------|---------------|
| `eq` | Equal to | `"California"` or `true` |
| `neq` | Not equal to | `"TX"` |
| `gt` | Greater than | `100` |
| `gte` | Greater than or equal | `1` |
| `lt` | Less than | `500` |
| `lte` | Less than or equal | `100` |
| `like` | SQL LIKE pattern | `"%United%"` |
| `ilike` | Case-insensitive LIKE | `"%united%"` |
| `in` | In array | `["CA","TX","FL"]` |

### Filter Schema

```json
{
  "conditions": [
    { "field": "name", "operator": "like", "value": "%test%" },
    { "field": "id", "operator": "gt", "value": 100 }
  ],
  "logicalOperator": "AND"
}
```

---

## Sorting

### JSON Sort Syntax

Sorting uses a JSON object with `conditions` array:

```
GET /v1/countries?sort={"conditions":[{"field":"name","direction":"ASC"}]}
```

### Multiple Sort Fields

Multiple sort conditions are specified in the `conditions` array:

```
GET /v1/states?sort={"conditions":[{"field":"isActive","direction":"DESC"},{"field":"name","direction":"ASC"}]}
```

### Sort Directions

| Direction | Description |
|-----------|-------------|
| `ASC` | Ascending order (A-Z, 0-9, oldest first) |
| `DESC` | Descending order (Z-A, 9-0, newest first) |

**Note:** Directions are case-insensitive (`asc`, `ASC`, `Asc` all work).

### Default Sorting

Each endpoint should define a default sort when none is specified:
- **Countries**: `name ASC`
- **Regions**: `name ASC`
- **Companies**: `created ASC`, `id ASC`

---

## Search

### Search Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search query text |

### Search Behavior

Search automatically adapts based on field configuration:

| Field Type | Behavior | Description |
|------------|----------|-------------|
| Text fields | `partial` | Case-insensitive ILIKE matching |
| Code fields | `exact` | Exact match for codes (alpha2, state code) |
| Numeric fields | `range` | Numeric comparison for IDs, numbers |

### Search Configuration

Fields are configured with `@Searchable` decorator options:

```typescript
@Searchable({ 
  weight: 10,           // Relevance weight (1-10)
  behavior: 'partial',  // Search behavior
  type: 'string',       // Field type
  description: 'Country display name' 
})
name!: string;

@Searchable({ 
  type: 'integer', 
  weight: 5, 
  behavior: 'exact',
  description: 'International dialing code' 
})
dialingCode!: number;
```

### Example

```bash
# Text search (partial matching)
GET /v1/countries?search=united

# Numeric search (finds by ISO number, dialing code, or ID)
GET /v1/countries?search=376
GET /v1/countries?search=1
```

### Metadata Discovery

Use the metadata API to discover searchable fields and their configuration:

```bash
GET /v1/countries/metadata/search
```

Response includes field weights, behaviors, and example queries.

---

## Entity Decorators

### Available Decorators

| Decorator | Purpose | SQL Operations |
|-----------|---------|----------------|
| `@Searchable(options?)` | Mark field as searchable | `ILIKE` / exact / range search |
| `@Filterable()` | Mark field as filterable | `WHERE` conditions |
| `@Sortable()` | Mark field as sortable | `ORDER BY` clause |

### @Searchable Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | `'string'` | Field type: `string`, `integer`, `numeric`, `date`, `boolean` |
| `weight` | number | `5` | Relevance weight (1-10, higher = more important) |
| `behavior` | string | inferred | Search behavior: `exact`, `partial`, `range`, `prefix`, `suffix` |
| `description` | string | - | Human-readable description for metadata API |

### Usage Example

```typescript
import { Entity, Column } from 'typeorm';
import { Searchable, Filterable, Sortable } from '@exprealty/database';

@Entity({ name: 'country', schema: 'core' })
export class CountryEntity extends AuditableEntity {
  @Column({ type: 'integer' })
  @Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique identifier' })
  @Filterable()
  @Sortable()
  id!: number;

  @Column({ type: 'text' })
  @Searchable({ weight: 10, behavior: 'partial', description: 'Country display name' })
  @Filterable()
  @Sortable()
  name!: string;

  @Column({ name: 'alpha_2', type: 'varchar', length: 2, unique: true })
  @Searchable({ weight: 8, behavior: 'exact', description: 'ISO 3166-1 alpha-2 code' })
  @Filterable()
  @Sortable()
  alpha2!: string;

  @Column({ name: 'dialing_code', type: 'integer' })
  @Searchable({ type: 'integer', weight: 5, behavior: 'exact', description: 'International dialing code' })
  @Filterable()
  @Sortable()
  dialingCode!: number;
}
```

### Field Validation

When `QueryService.normalizeWithValidation()` is used:
- Filter fields are validated against `@Filterable()` decorated fields
- Sort fields are validated against `@Sortable()` decorated fields
- Search fields are validated against `@Searchable()` decorated fields
- Invalid fields result in a `400 Bad Request` error

---

## Response Format

### Envelope Structure

All paginated endpoints return responses in this format:

```json
{
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "meta": {
    "total": 157,
    "totalPages": 7,
    "currentPage": 1,
    "limit": 25,
    "offset": 0,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Envelope Modes

The `PaginationInterceptor` supports different envelope modes:

| Mode | Behavior |
|------|----------|
| `auto` | Wrap if handler returns `{ items, total }` or array |
| `always` | Always wrap response in envelope |
| `never` | Never wrap; only set headers |

### Count-less Mode

For performance with large datasets, enable `countLess: true`:
- Skips `COUNT(*)` query
- `X-Total-Count` header is omitted
- `meta.total` and `meta.totalPages` are not included
- `hasNext` is inferred from `items.length >= limit`

---

## Implementation Guide

### Repository Pattern

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryService } from '../../common/query/query.service.js';
import type { QueryParams } from '@exprealty/shared-domain';

@Injectable()
export class CountriesTypeOrmRepository implements ICountriesRepository {
  constructor(
    @InjectRepository(CountryEntity)
    private readonly repo: Repository<CountryEntity>,
    private readonly queryService: QueryService,
  ) {}

  async findPage(query: Partial<QueryParams>): Promise<PageResult<Country>> {
    // 1. Validate and normalize query params using entity decorators
    const normalized = this.queryService.normalizeWithValidation(query, CountryEntity);

    // 2. Build query with TypeORM query builder
    const qb = this.repo.createQueryBuilder('country');

    // 3. Apply filters, search, and sorting
    this.queryService.applyAll(qb, normalized, 'country');

    // 4. Default sort if none specified
    if (!normalized.sort || normalized.sort.conditions.length === 0) {
      qb.orderBy('country.name', 'ASC');
    }

    // 5. Apply pagination
    qb.skip(normalized.offset).take(normalized.limit);

    // 6. Execute query
    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map(mapEntity),
      total,
    };
  }
}
```

### Controller Pattern

```typescript
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js';

@Controller('v1/countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  async findAll(
    @Query() query: any,
  ): Promise<{ items: CountryResponseDto[]; total: number }> {
    const { countries, total } = await this.countriesService.findPage(query);
    return { items: countries, total };
  }
}
```

---

## API Examples

### Metadata Discovery

```bash
# List all available entities
GET /v1/metadata/entities

# Get complete metadata for an entity
GET /v1/countries/metadata

# Get only searchable fields
GET /v1/countries/metadata/search

# Get only filterable fields
GET /v1/states/metadata/filters

# Get only sortable fields
GET /v1/regions/metadata/sort
```

### Basic Pagination

```bash
# First page with default limit (25)
GET /v1/countries

# Second page
GET /v1/countries?offset=25&limit=25

# Custom page size
GET /v1/countries?offset=0&limit=10
```

### Filtering

```bash
# Simple filter
GET /v1/states?filter=isActive:eq:true

# Multiple filters (AND logic)
GET /v1/states?filter=isActive:eq:true&filter=code:in:CA,TX,FL

# Contains filter
GET /v1/countries?filter=name:contains:united

# Numeric comparison
GET /v1/countries?filter=dialingCode:gte:1&filter=dialingCode:lte:99
```

### Sorting

```bash
# Single sort
GET /v1/countries?sort=name:ASC

# Multiple sorts
GET /v1/states?sort=isActive:DESC&sort=name:ASC
```

### Search

```bash
# Text search
GET /v1/countries?search=united

# Numeric search (finds by ID, ISO number, dialing code)
GET /v1/countries?search=376
GET /v1/countries?search=1
```

### Combined Query

```bash
# Search, filter, sort, and pagination combined
GET /v1/states?search=cal&filter=isActive:eq:true&sort=name:ASC&limit=10&offset=0

# With relations
GET /v1/states?include=country,region&filter=isActive:eq:true&limit=5
```

---

## Error Handling

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Invalid filter fields | Field not decorated with `@Filterable()` |
| 400 | Invalid sort fields | Field not decorated with `@Sortable()` |
| 400 | Invalid search fields | Field not decorated with `@Searchable()` |
| 400 | Invalid pagination query | `limit > 50`, `offset < 0`, non-integer values |
| 400 | Invalid filter JSON format | Malformed JSON in filter parameter |
| 400 | Unsupported filter operator | Unknown operator in filter condition |

### Error Response Format

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid filter fields: invalidField. Allowed fields: name, alpha2, alpha3, number",
  "instance": "/v1/countries"
}
```

---

## Best Practices

### DO

- ✅ Always use `@Filterable()`, `@Sortable()`, `@Searchable()` decorators on entity fields
- ✅ Define default sorting for all list endpoints
- ✅ Use `normalizeWithValidation()` to validate fields against entity
- ✅ Return `{ items, total }` from handlers to leverage `PaginationInterceptor`
- ✅ Document allowed fields in OpenAPI specs

### DON'T

- ❌ Don't allow filtering/sorting on sensitive fields (passwords, tokens)
- ❌ Don't expose internal field names (use DTO mapping)
- ❌ Don't skip validation in production code
- ❌ Don't use `synchronize: true` in production
- ❌ Don't allow unlimited page sizes (`limit` is capped at 50)

---

## Related Documentation

- [Database Migrations Standards](./DATABASE-MIGRATIONS-STANDARDS.md)
- [API Design Guidelines](../ADRs/002-base-expanded-schema-pattern.md)
- [Domain Model Reference](../DOMAIN-MODEL-REFERENCE.md)
