# Query Service Documentation

This document describes the query capabilities available across all API endpoints in the agent-service.

## Overview

The `QueryService` provides a unified way to filter, sort, search, and paginate data across all entities. It integrates with TypeORM's QueryBuilder and supports validation against entity-defined decorators.

## Metadata API

Discover available fields and capabilities for any entity:

| Endpoint | Description |
|----------|-------------|
| `GET /v1/metadata/entities` | List all entities with metadata URLs |
| `GET /v1/:entity/metadata` | Complete metadata (search, filter, sort) |
| `GET /v1/:entity/metadata/search` | Searchable fields only |
| `GET /v1/:entity/metadata/filters` | Filterable fields only |
| `GET /v1/:entity/metadata/sort` | Sortable fields only |

**Example:**
```bash
curl http://localhost:3000/v1/countries/metadata
curl http://localhost:3000/v1/states/metadata/search
```

## Query Parameters

### Pagination

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `offset` | number | 0 | - | Number of records to skip |
| `limit` | number | 25 | 50 | Maximum number of records to return |

**Example:**
```
GET /v1/states?offset=0&limit=10
```

### Filtering

Filters allow you to narrow down results based on field values.

#### Filter Syntax (JSON)

Filters use a JSON object with `conditions` array and `logicalOperator`:

```
GET /v1/states?filter={"conditions":[{"field":"isActive","operator":"eq","value":true}],"logicalOperator":"AND"}
```

**Multiple conditions (AND logic):**
```
GET /v1/states?filter={"conditions":[{"field":"isActive","operator":"eq","value":true},{"field":"code","operator":"in","value":["CA","TX","FL"]}],"logicalOperator":"AND"}
```

#### Filter Operators

| Operator | Description | Example Value |
|----------|-------------|---------------|
| `eq` | Equal to | `"California"` or `true` |
| `neq` | Not equal to | `"TX"` |
| `gt` | Greater than | `100` |
| `gte` | Greater than or equal | `1` |
| `lt` | Less than | `500` |
| `lte` | Less than or equal | `100` |
| `like` | SQL LIKE pattern | `"%United%"` |
| `in` | In array | `["CA","TX","FL"]` |

### Sorting

Sort results using JSON format with `conditions` array.

**Examples:**
```
GET /v1/states?sort={"conditions":[{"field":"name","direction":"ASC"}]}
GET /v1/states?sort={"conditions":[{"field":"name","direction":"DESC"}]}
GET /v1/states?sort={"conditions":[{"field":"isActive","direction":"DESC"},{"field":"name","direction":"ASC"}]}
```

#### Sort Directions

- `ASC`: Ascending (A-Z, 0-9, oldest first)
- `DESC`: Descending (Z-A, 9-0, newest first)

### Searching

Full-text search across configured searchable fields with intelligent type detection.

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | The search query |

**Examples:**
```bash
# Text search (partial matching)
GET /v1/countries?search=united

# Numeric search (exact or range)
GET /v1/countries?search=376        # Finds by ISO number, dialing code, or ID
GET /v1/countries?search=1          # Finds countries with dialing code 1

# Combined with filters
GET /v1/states?search=cal&filter=isActive:eq:true
```

#### Search Behavior by Field Type

The `@Searchable` decorator configures how each field is searched:

| Behavior | Description | Example Fields |
|----------|-------------|----------------|
| `partial` | Case-insensitive ILIKE matching | `name`, `email` |
| `exact` | Exact match (for codes, IDs) | `alpha2`, `code` |
| `range` | Numeric comparison | `id`, `number`, `dialingCode` |

#### Search Weights

Fields have weights (1-10) that affect result relevance:

- **Weight 10**: Primary fields (name)
- **Weight 8**: Important codes (alpha2, alpha3, state code)
- **Weight 5-6**: Secondary identifiers (number, dialingCode)
- **Weight 3-4**: IDs and foreign keys

### Field Projection

Control which fields are returned in the response.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | string | Comma-separated list of fields to include |
| `include` | string | Comma-separated list of relations to include |

**Example:**
```
GET /v1/states?fields=id,name,code
GET /v1/states?include=country,region
GET /v1/states?fields=id,name&include=country
```

## Entity Configuration

Each entity defines which fields are allowed for filtering, sorting, and searching using decorators:

### Decorators

```typescript
import { Filterable, Sortable, Searchable } from '@exprealty/database';

@Entity()
class CountryEntity {
  @Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique identifier' })
  @Filterable()
  @Sortable()
  id!: number;

  @Searchable({ weight: 10, behavior: 'partial', description: 'Country display name' })
  @Filterable()
  @Sortable()
  name!: string;

  @Searchable({ weight: 8, behavior: 'exact', description: 'ISO alpha-2 code' })
  @Filterable()
  @Sortable()
  alpha2!: string;

  @Searchable({ type: 'integer', weight: 5, behavior: 'exact', description: 'Dialing code' })
  @Filterable()
  @Sortable()
  dialingCode!: number;
}
```

### @Searchable Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | `'string'` | Field type: `string`, `integer`, `numeric`, `date`, `boolean` |
| `weight` | number | `5` | Relevance weight (1-10, higher = more important) |
| `behavior` | string | inferred | Search behavior: `exact`, `partial`, `range`, `prefix`, `suffix` |
| `description` | string | - | Human-readable description for metadata API |

### Countries Endpoint

**Searchable fields:** `id`, `name`, `alpha2`, `alpha3`, `number`, `dialingCode`  
**Filterable fields:** `id`, `name`, `alpha2`, `alpha3`, `number`, `dialingCode`, `created`, `lastModified`  
**Sortable fields:** Same as filterable  

### States Endpoint

**Searchable fields:** `name`, `code`, `email`, `regionId`, `countryId`  
**Filterable fields:** `id`, `name`, `code`, `isActive`, `email`, `regionId`, `countryId`, `created`, `lastModified`  
**Sortable fields:** Same as filterable  
**Available relations:** `region`, `country`

## Response Format

### Paginated Response

```json
{
  "data": [
    { "id": "...", "name": "California", ... }
  ],
  "meta": {
    "total": 50,
    "totalPages": 2,
    "currentPage": 1,
    "limit": 25,
    "offset": 0,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Total-Count` | Total number of records |
| `Link` | RFC 8288 pagination links (rel=next, rel=prev, rel=first, rel=last) |

## Error Responses

### Invalid Filter Field

```json
{
  "statusCode": 400,
  "message": "Invalid filter fields: invalidField. Allowed fields: id, name, code, isActive, regionId"
}
```

### Invalid Sort Field

```json
{
  "statusCode": 400,
  "message": "Invalid sort fields: invalidField. Allowed fields: name, code, created, lastModified"
}
```

### Invalid Relation

```json
{
  "statusCode": 400,
  "message": "Invalid relations requested: invalidRelation",
  "error": "Bad Request",
  "availableRelations": ["region", "country"]
}
```

## Reserved Word Handling

PostgreSQL reserved words (like `number`, `order`, `group`, `user`, `type`, `name`, `date`, etc.) are automatically quoted when used in queries to prevent SQL syntax errors.

## Complete Examples

```bash
# Search for countries with "united" in name
curl "http://localhost:3000/v1/countries?search=united"

# Search by numeric value (finds by ISO number, dialing code, etc.)
curl "http://localhost:3000/v1/countries?search=376"

# Filter with simple syntax
curl "http://localhost:3000/v1/states?filter=isActive:eq:true"

# Multiple filters
curl "http://localhost:3000/v1/states?filter=isActive:eq:true&filter=code:in:CA,TX,FL"

# Sort results
curl "http://localhost:3000/v1/countries?sort=name:ASC"

# Combined search, filter, sort, and pagination
curl "http://localhost:3000/v1/states?search=cal&filter=isActive:eq:true&sort=name:ASC&limit=10"

# With relations
curl "http://localhost:3000/v1/states?include=country,region&limit=5"

# Get entity metadata to discover capabilities
curl "http://localhost:3000/v1/countries/metadata"
curl "http://localhost:3000/v1/states/metadata/search"
```

## Development Environment

In `local` and `dev` environments, query metadata is included in responses:

```json
{
  "data": [...],
  "meta": {
    "total": 50,
    "query": {
      "search": "united",
      "filters": [],
      "sort": { "field": "name", "direction": "ASC" },
      "executionTime": "12ms"
    }
  }
}
```

In `staging` and `prod`, only headers are included for performance.
