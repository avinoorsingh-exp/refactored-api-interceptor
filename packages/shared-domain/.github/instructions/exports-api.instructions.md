# Exports & API Documentation Instructions

## Purpose

This file documents the patterns and requirements for **exporting** types, schemas, and utilities from the shared-domain package, and maintaining proper **API documentation**.

## File Patterns

**Applies to**: `**/index.ts`, `**/src/index.ts`, `**/*.d.ts`

---

## Export Philosophy

The shared-domain package is the **Single Source of Truth** for:

- Domain types and schemas
- Value objects with branded types
- Validation constraints
- Query parameter schemas
- Problem Details (RFC 9457)
- i18n error mapping

**Every export must be intentional, documented, and stable.**

---

## Export Structure

### Main Entry Point (`src/index.ts`)

```typescript
// ============================================================================
// VALUE OBJECTS (Branded Types)
// ============================================================================
export {
  // Names
  NameBranded,
  type Name,
  
  // Contact
  EmailBranded,
  type Email,
  PhoneNumberBranded,
  type PhoneNumber,
  UrlBranded,
  type Url,
  
  // Location
  CityBranded,
  type City,
  PostalCodeBranded,
  type PostalCode,
  
  // Date/Time
  DateOnlyISO,
  type DateOnlyISO,
  InstantUTC,
  type InstantUTC,
  
  // Security
  HashBranded,
  type Hash,
} from './value-objects/index.js'

// ============================================================================
// CONSTRAINTS
// ============================================================================
export {
  NAME,
  EMAIL,
  PHONE,
  ADDRESS,
  ID,
  AGENT,
  COMPANY,
  OFFICE,
  // ... all entity constraints
} from './value-objects/contraints.js'

// ============================================================================
// COMMON SCHEMAS
// ============================================================================
export {
  // Audit
  AuditableSchema,
  type Auditable,
  
  // Enums
  CountryCode,
} from './common/index.js'

// ============================================================================
// PAGINATION & QUERY
// ============================================================================
export {
  // Constants
  LIMIT_DEFAULT,
  LIMIT_MAX,
  
  // Schemas
  PaginationQuerySchema,
  PaginationMetaSchema,
  NormalizedPaginationSchema,
  type PaginationQuery,
  type PaginationMeta,
  type NormalizedPagination,
  
  // Query
  QueryParamsSchema,
  NormalizedQueryParamsSchema,
  type QueryParams,
  
  // Filter
  FilterSchema,
  FilterConditionSchema,
  FilterOperatorSchema,
  LogicalOperatorSchema,
  FilterOperatorEnum,
  LogicalOperatorEnum,
  type Filter,
  type FilterCondition,
  type FilterOperator,
  type LogicalOperator,
  
  // Sort
  SortSchema,
  SortConditionSchema,
  SortDirectionSchema,
  SortDirectionEnum,
  type Sort,
  type SortCondition,
  type SortDirection,
  
  // Search
  SearchSchema,
  type Search,
} from './common/index.js'

// ============================================================================
// PROBLEM DETAILS (RFC 9457)
// ============================================================================
export {
  // Types
  type ProblemDetails,
  type InvalidParam,
  
  // Constants
  DEFAULT_PROBLEM_BASE,
  ProblemKeys,
  ProblemTypes,
  ProblemTitles,
  
  // Functions
  makeProblemType,
  createProblem,
  Problems,
} from './common/problem-details.js'

// ============================================================================
// VALIDATION
// ============================================================================
export { validationErrorMap } from './validation/error-map.js'

// ============================================================================
// BASE SCHEMA HELPERS
// ============================================================================
export {
  trimmedString,
  trimmedStringOptional,
  trimmedStringMin,
  trimmedStringMinMax,
  nonEmptyString,
  emailString,
  urlString,
  numericString,
  lifecycleString,
  lifecycleEnum,
} from './schemas/base-schemas.js'

// ============================================================================
// ENTITY SCHEMAS (alphabetical)
// ============================================================================

// Agent
export {
  AgentBaseSchema,
  AgentExpandedSchema,
  AgentSchema,
  CreateAgentInput,
  UpdateAgentInput,
  AgentIdParamSchema,
  AgentLifecycleStatus,
  AgentSuffix,
  AgentTitle,
  AGENT_LIFECYCLE_VALUES,
  type AgentBase,
  type AgentExpanded,
  type Agent,
  type AgentIdParam,
} from './schemas/agent.js'

// Continue for all entities...
```

---

## Export Categories

### 1. Schemas (Runtime Validation)

Export both schema and inferred type:

```typescript
export { EntityBaseSchema } from './schemas/entity.js'
export type { EntityBase } from './schemas/entity.js'
```

### 2. Value Objects (Branded Types)

Export schema for parsing and type for type annotations:

```typescript
export { NameBranded } from './value-objects/name.js'
export type { Name } from './value-objects/name.js'
```

### 3. Constants

Export as values for runtime access:

```typescript
export { NAME, EMAIL, PHONE } from './value-objects/contraints.js'
export { LIMIT_DEFAULT, LIMIT_MAX } from './common/paging.js'
```

### 4. Enums

Export both the Zod schema and extracted enum object:

```typescript
export { FilterOperatorSchema } from './common/query/filter.schema.js'
export { FilterOperatorEnum } from './common/query/filter.schema.js'
export type { FilterOperator } from './common/query/filter.schema.js'
```

### 5. Functions

Export helper functions for creating domain objects:

```typescript
export { makeProblemType, createProblem, Problems } from './common/problem-details.js'
```

---

## Requirements

### MUST Follow

1. **Export both schema and type**:
   ```typescript
   // ✅ Correct - exports both
   export { EntitySchema } from './schemas/entity.js'
   export type { Entity } from './schemas/entity.js'
   
   // ❌ Wrong - missing type export
   export { EntitySchema } from './schemas/entity.js'
   ```

2. **Use `type` keyword for type-only exports**:
   ```typescript
   export type { Entity } from './schemas/entity.js'  // ✅
   export { Entity } from './schemas/entity.js'       // ❌ May cause issues
   ```

3. **Organize exports in logical sections** with comments:
   ```typescript
   // ============================================================================
   // SECTION NAME
   // ============================================================================
   export { ... }
   ```

4. **Mark public API with JSDoc**:
   ```typescript
   /**
    * Zod schema for agent entity.
    * @public
    */
   export const AgentSchema = z.object({...})
   ```

5. **Use barrel exports** for subdirectories:
   ```typescript
   // value-objects/index.ts
   export * from './name.js'
   export * from './email.js'
   export * from './phone-number.js'
   ```

### MUST NOT Do

1. **Never export internal implementation details**:
   ```typescript
   // ❌ Internal helper, don't export
   const _validateInternal = () => {...}
   ```

2. **Never export mutable objects**:
   ```typescript
   // ❌ Mutable - can be modified by consumers
   export const config = { min: 2, max: 50 }
   
   // ✅ Immutable
   export const config = { min: 2, max: 50 } as const
   ```

3. **Never use default exports** in shared packages:
   ```typescript
   export default AgentSchema  // ❌ Hard to tree-shake
   export { AgentSchema }       // ✅ Named export
   ```

4. **Never export from `index.ts` with wildcards** for schemas:
   ```typescript
   export * from './schemas/agent.js'  // ❌ May export internals
   export { AgentSchema, type Agent } from './schemas/agent.js'  // ✅ Explicit
   ```

---

## API Documentation (API Extractor)

### @public Tag

Mark all exported items as public:

```typescript
/**
 * Zod schema for validating agent entities.
 * 
 * @example
 * ```typescript
 * const agent = AgentSchema.parse(rawData)
 * ```
 * 
 * @public
 */
export const AgentSchema = z.object({...})
```

### @internal Tag

Mark implementation details that shouldn't be exported:

```typescript
/**
 * Internal validation helper.
 * @internal
 */
const validateInternal = () => {...}
```

### @deprecated Tag

Mark deprecated exports with migration path:

```typescript
/**
 * @deprecated Use OfficeExpandedSchema instead
 * @public
 */
export const OfficeSchema = OfficeExpandedSchema
```

---

## Versioning & Breaking Changes

### Semantic Versioning Rules

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| New export added | Minor | New entity schema |
| Bug fix in validation | Patch | Fix regex pattern |
| Remove export | **Major** | Remove deprecated schema |
| Change schema shape | **Major** | Add required field |
| Change constraint values | **Minor/Major** | Depends on direction |

### Breaking Change Checklist

Before making breaking changes:

1. ☐ Add `@deprecated` warning in current version
2. ☐ Document migration path in deprecation message
3. ☐ Update CHANGELOG.md
4. ☐ Notify dependent teams
5. ☐ Schedule removal for next major version

---

## Import Patterns for Consumers

### Recommended Usage

```typescript
// ✅ Import specific items
import { 
  AgentSchema, 
  NameBranded, 
  NAME 
} from '@exprealty/shared-domain'

// ✅ Import types with type keyword
import type { Agent, Name } from '@exprealty/shared-domain'
```

### Discouraged Usage

```typescript
// ❌ Namespace import - prevents tree-shaking
import * as SharedDomain from '@exprealty/shared-domain'

// ❌ Deep imports - may break with refactoring
import { AgentSchema } from '@exprealty/shared-domain/src/schemas/agent'
```

---

## File Organization

### Recommended Structure

```
src/
├── index.ts              # Main entry - all exports
├── common/
│   ├── index.ts          # Barrel export for common
│   ├── paging.ts
│   ├── problem-details.ts
│   ├── enums.ts
│   └── query/
│       ├── index.ts      # Barrel for query
│       ├── filter.schema.ts
│       ├── sort.schema.ts
│       └── search.schema.ts
├── schemas/
│   ├── index.ts          # Barrel for schemas
│   ├── audit.ts
│   ├── base-schemas.ts
│   ├── agent.ts
│   └── ...
├── validation/
│   ├── index.ts
│   └── error-map.ts
└── value-objects/
    ├── index.ts          # Barrel for value objects
    ├── contraints.ts
    ├── name.ts
    ├── email.ts
    └── ...
```

### Barrel File Pattern

```typescript
// value-objects/index.ts
export * from './name.js'
export * from './email.js'
export * from './phone-number.js'
export * from './postal-code.js'
export * from './city.js'
export * from './url.js'
export * from './hash.js'
export * from './dates.js'
export { NAME, EMAIL, PHONE, ADDRESS, ... } from './contraints.js'
```

---

## Testing Exports

```typescript
describe('package exports', () => {
  it('should export all value objects', () => {
    expect(NameBranded).toBeDefined()
    expect(EmailBranded).toBeDefined()
    expect(PhoneNumberBranded).toBeDefined()
  })

  it('should export all constraints', () => {
    expect(NAME).toEqual({ min: 2, max: 50 })
    expect(EMAIL).toEqual({ maxLen: 255 })
  })

  it('should export all problem creators', () => {
    expect(Problems.validation).toBeInstanceOf(Function)
    expect(Problems.notFound).toBeInstanceOf(Function)
  })

  it('should export schema types correctly', () => {
    // Type-only test - verified at compile time
    const schema: typeof AgentSchema = AgentSchema
    type AgentType = z.infer<typeof AgentSchema>
  })
})
```
