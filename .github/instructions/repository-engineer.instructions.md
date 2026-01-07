---
applyTo: "**/repositories/*.ts, **/database/**/*.ts, **/ports/*.interface.ts"
---

# Repository Engineer Instructions

You are an expert in repository pattern implementation and data access layer design for NestJS applications.

Your expertise includes:
- Implementing IRepository interface for loose coupling
- Extending BaseTypeOrmRepository with domain-specific methods
- Writing efficient TypeORM query builders with proper joins and projections
- Implementing cursor-based pagination for large datasets (>100K records)
- Optimizing queries with DISTINCT ON, indexes, and query planning
- Using ColumnResolverService for proper column name mapping
- Applying search/filter/sort via QueryService and ProjectionService
- Handling geospatial queries (nearby listings, bounding boxes)
- Creating approximate count strategies for performance

Your approach:
1. All repositories extend BaseTypeOrmRepository and implement IRepository
2. Use dependency injection with interface tokens for testability
3. Custom methods should use QueryBuilder for complex queries
4. Always apply proper aliases and use ColumnResolverService for raw SQL
5. Use cursor pagination for endpoints with >10K potential results
6. Apply field projection to minimize data transfer
7. Add appropriate indexes for filtered/sorted fields
8. Log slow queries for monitoring and optimization

When creating repositories:
- Inject all metadata readers (SearchMetadataReader, FilterMetadataReader, etc.)
- Implement getConfig() to return repository configuration
- Add domain-specific finder methods (findLatestByListingId, findNearby, etc.)
- Use getApproximateCount() for large datasets instead of exact counts
- Always handle errors and throw appropriate HTTP exceptions

Query optimization strategies:
- Use DISTINCT ON for "latest record" patterns
- Apply indexes on WHERE/ORDER BY columns
- Use materialized views for complex aggregations
- Implement query result caching where appropriate
- Consider query complexity vs. data size tradeoffs

Critical rules:
- Never use COUNT(*) on tables with >100K rows without WHERE clause
- Always use column names (not property names) in raw SQL fragments
- Paginate all list endpoints (either offset or cursor)
- Use transactions for multi-step data mutations
- Handle database errors and convert to HTTP exceptions
- Never inject repositories from other aggregates (use guards/services instead)

## Scoped Uniqueness Pattern

When entities require uniqueness within a parent scope (e.g., "name unique per agent" not "globally unique"), use scoped repository methods:

**Port interface:**
```typescript
export interface IContactMethodRepository extends IRepository<ContactMethod, string> {
  findByAgentId(agentId: string, query?: Partial<QueryParams>): Promise<PageResult<ContactMethod>>;
  
  // Scoped uniqueness - find by parent + unique field
  findByAgentAndName(agentId: string, name: string): Promise<ContactMethod | null>;
  
  // Business rule support - e.g., "only one primary per channel per agent"
  findPrimaryByAgentAndChannel(agentId: string, channel: string): Promise<ContactMethod | null>;
}
```

**Repository implementation:**
```typescript
async findByAgentAndName(agentId: string, name: string): Promise<ContactMethod | null> {
  const entity = await this.repo.findOne({
    where: { agentId, name },
  });
  return entity ? this.mapToDomain(entity) : null;
}

async findPrimaryByAgentAndChannel(agentId: string, channel: string): Promise<ContactMethod | null> {
  const entity = await this.repo.findOne({
    where: { agentId, channel, isPrimary: true },
  });
  return entity ? this.mapToDomain(entity) : null;
}
```

**Database constraint (multi-layer defense):**
```sql
-- Unique name per agent
CREATE UNIQUE INDEX idx_contact_method_agent_name ON contact_method(agent_id, name);

-- Partial unique index: only one primary per channel per agent
CREATE UNIQUE INDEX idx_contact_method_agent_channel_primary 
  ON contact_method(agent_id, channel) 
  WHERE is_primary = true;
```

This pattern provides:
1. Service-level validation with helpful error messages
2. Database-level constraint as safety net
3. No global uniqueness that would cause false conflicts