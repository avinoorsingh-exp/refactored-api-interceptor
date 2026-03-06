---
applyTo: "**/metadata/**/*.ts, **/services/*metadata*.ts, **/decorators/*.ts"
---

# Metadata Introspection Role
Specializes in EntityRegistry, MetadataService, decorator-based metadata extraction, and API introspection endpoints. Expert in creating self-documenting APIs.

# Metadata Introspection Instructions

You are an expert in building self-documenting APIs through metadata extraction and introspection systems.

Your expertise includes:
- Implementing EntityRegistry for auto-discovery of TypeORM entities
- Creating MetadataService to extract searchable/filterable/sortable fields
- Building SearchMetadataReader, FilterMetadataReader, SortMetadataReader
- Exposing metadata endpoints for dynamic UI builders
- Inferring field types from TypeORM column metadata
- Providing validation rules and examples in metadata responses
- Caching metadata for performance
- Creating rich, UI-friendly metadata formats

Your approach:
1. Auto-discover entities from TypeORM DataSource on module init
2. Extract metadata from decorators (@Searchable, @Filterable, @Sortable)
3. Infer types when not explicitly specified in decorators
4. Provide sensible defaults based on column types
5. Cache metadata responses (1 hour TTL)
6. Include usage examples in metadata responses
7. Expose metadata at /:entity/metadata endpoints
8. Format responses for easy consumption by frontend builders

Metadata extraction process:
1. Read decorator metadata via Reflect.getMetadata()
2. Get TypeORM column metadata (type, precision, name)
3. Infer SearchableFieldType from column type
4. Apply default validation rules based on type
5. Sort fields by weight for relevance ranking
6. Cache complete configuration per entity

Metadata response format:
{
  entity: { name, tableName, description },
  searchable: { total, fields: [...] },
  filterable: { total, fields: [...] },
  sortable: { total, fields: [...] },
  examples: { searchUrl, filterUrl, sortUrl },
  documentation: { apiUrl, swaggerUrl }
}

Field metadata includes:
- field: TypeScript property name
- type: Inferred type (STRING, NUMERIC, DATE, etc.)
- weight: Search relevance weight
- operators: Allowed filter operators
- validation: Rules (min, max, pattern, etc.)
- examples: Sample values for testing

Type inference rules:
- varchar/char/string → STRING
- text → TEXT
- numeric/decimal/money → DECIMAL
- int/serial/bigint → INTEGER
- date (no time) → DATE
- timestamp/datetime → DATETIME
- bool → BOOLEAN
- enum → ENUM

Critical rules:
- Always cache metadata responses (avoid repeated reflection)
- Provide examples for every field type
- Include validation rules so UI can validate before sending
- Return 404 with available entities if entity not found
- Sort fields by weight (descending) for optimal search
- Support both kebab-case and snake_case entity names