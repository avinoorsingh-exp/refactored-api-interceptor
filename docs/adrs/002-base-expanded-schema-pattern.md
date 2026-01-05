# ADR-002: Base and Expanded Schema Pattern

**Status:** Accepted  
**Date:** 2025-10-21  
**Decision Makers:** Architecture Team

## Context

When building applications with rich domain models and complex object graphs, we face a common performance challenge: loading too much data when displaying list views, and not enough data when showing detail views. This leads to:

1. **N+1 query problems** when relationships aren't eagerly loaded
2. **Slow list endpoints** when we over-fetch related data
3. **Multiple round trips** when detail views need related entities
4. **Inconsistent data fetching** across different parts of the application

## Decision

We will adopt a **Base and Expanded Schema Pattern** for all domain entities. Each entity will have two variants:

### 1. Base Schema (`EntityBaseSchema`)

- **Purpose:** Optimized for list views and search results
- **Contains:** Only the entity's own fields (no relationships)
- **Use When:**
  - Displaying tables/grids of data
  - Search results
  - Dropdown options
  - Any scenario where you don't need related data

### 2. Expanded Schema (`EntityExpandedSchema`)

- **Purpose:** Complete object graph for detail views
- **Contains:** All base fields PLUS lazy-loaded relationships
- **Use When:**
  - Detail pages
  - Forms that need related data
  - Reports that need the full context
  - Any scenario where you need to traverse relationships

## Pattern Structure

```typescript
// Example: Agent Entity

/**
 * Base schema - minimal data for lists
 * @public
 */
export const AgentBaseSchema = z.object({
	id: z.string().uuid(),
	firstName: NameBranded,
	lastName: NameBranded,
	lifecycleStatus: AgentLifecycleStatus.nullable(),
	// ... other direct fields only
	createdAt: InstantUTC,
	updatedAt: InstantUTC,
})

/**
 * Expanded schema - includes relationships
 * @public
 */
export const AgentExpandedSchema = AgentBaseSchema.extend({
	// Lazy-loaded relationships
	agentCompany: z.lazy(() => AgentCompanyBaseSchema).optional(),
	addresses: z.lazy(() => z.array(AgentAddressBaseSchema)).optional(),
	artifacts: z.lazy(() => z.array(ArtifactBaseSchema)).optional(),
})

export type AgentBase = z.infer<typeof AgentBaseSchema>
export type AgentExpanded = z.infer<typeof AgentExpandedSchema>
export type Agent = AgentExpanded // Default to expanded
```

## For Junior Developers

### When to use Base vs Expanded?

**Use `EntityBaseSchema`** when:

- ✅ Building a list/table of agents
- ✅ Populating a dropdown menu
- ✅ Showing search results
- ✅ Building a paginated grid
- ✅ You only need the entity's own data

```typescript
// Example: Agent list endpoint
async findAll(): Promise<AgentBase[]> {
  return this.repository.find({
    select: ['id', 'firstName', 'lastName', 'lifecycleStatus', 'createdAt'],
    // No relations loaded - fast query!
  });
}
```

**Use `EntityExpandedSchema`** when:

- ✅ Showing an agent detail page
- ✅ Editing a form that needs related data
- ✅ Generating a report with full context
- ✅ You need to display company name, addresses, etc.

```typescript
// Example: Agent detail endpoint
async findOne(id: string): Promise<AgentExpanded> {
  return this.repository.findOne({
    where: { id },
    relations: ['agentCompany', 'addresses', 'artifacts'],
    // Loads everything - slower but complete!
  });
}
```

### Performance Impact

```
📊 Benchmarkexample:

List Query (Base):
  - SELECT * FROM agents LIMIT 100
  - Time: ~5ms
  - Data transferred: ~50KB

List Query (Expanded - WRONG!):
  - SELECT * FROM agents + 5 JOIN statements
  - Time: ~150ms
  - Data transferred: ~500KB
  - Problem: Loading data you don't display!

Detail Query (Base - WRONG!):
  - SELECT * FROM agents WHERE id = ?
  - Then: 5 separate queries for relationships
  - Problem: N+1 queries, multiple round trips!

Detail Query (Expanded - CORRECT):
  - SELECT * FROM agents LEFT JOIN ... WHERE id = ?
  - Time: ~20ms
  - Data transferred: ~10KB
  - Perfect: One query, all data needed!
```

### Common Mistakes to Avoid

❌ **DON'T** use Expanded schemas for list endpoints:

```typescript
// BAD - Too slow!
async findAll(): Promise<AgentExpanded[]> {
  return this.repository.find({
    relations: ['agentCompany', 'addresses'], // Oops! Too much data
  });
}
```

❌ **DON'T** use Base schemas when you need relationships:

```typescript
// BAD - Will cause N+1 queries!
async getAgentDetail(id: string) {
  const agent = await this.findBase(id); // Only base data
  const company = await this.getCompany(agent.agentCompanyId); // Extra query!
  const addresses = await this.getAddresses(agent.id); // Extra query!
  // This is 3 queries instead of 1!
}
```

✅ **DO** match the schema to your use case:

```typescript
// GOOD - Fast list
async findAll(): Promise<AgentBase[]> {
  return this.repository.find(); // Base fields only
}

// GOOD - Complete detail
async findOne(id: string): Promise<AgentExpanded> {
  return this.repository.findOne({
    where: { id },
    relations: ['agentCompany', 'addresses'], // Load everything once
  });
}
```

### TypeORM Integration

```typescript
// Repository method naming convention
class AgentRepository {
	// Returns base data
	async findAllBase(): Promise<AgentBase[]> {
		return this.find()
	}

	// Returns expanded data
	async findOneExpanded(id: string): Promise<AgentExpanded | null> {
		return this.findOne({
			where: { id },
			relations: ['agentCompany', 'addresses', 'artifacts'],
		})
	}
}
```

### REST API Guidelines

```
GET /api/agents           → AgentBase[]    (list)
GET /api/agents/:id       → AgentExpanded  (detail)
GET /api/agents/:id?expand=false → AgentBase (explicit base)
```

## Benefits

1. **Performance:** List views are 10-30x faster
2. **Clarity:** Developers know exactly what data is loaded
3. **Type Safety:** TypeScript enforces correct usage
4. **Consistency:** Same pattern across all entities
5. **Scalability:** Works well with large datasets

## Consequences

### Positive

- Explicit control over data loading
- Clear separation of concerns
- Better query performance
- Reduced bandwidth usage

### Negative

- More schema definitions to maintain
- Developers must choose the right schema
- Slight learning curve for new team members

## Related Patterns

- **Repository Pattern:** Use different repository methods for Base vs Expanded
- **DTO Pattern:** Base schemas map well to list DTOs, Expanded to detail DTOs
- **GraphQL:** Similar to GraphQL field selection, but at the schema level

## Examples in Codebase

- `/packages/shared-domain/src/entities/agent.ts`
- `/packages/shared-domain/src/entities/agent-company.ts`
- `/packages/shared-domain/src/entities/address.ts`
- `/packages/database/src/entities/*.entity.ts`

## References

- [TypeORM Relations Documentation](https://typeorm.io/relations)
- [Zod Lazy Types](https://zod.dev/?id=lazy)
- Martin Fowler's "Patterns of Enterprise Application Architecture"
