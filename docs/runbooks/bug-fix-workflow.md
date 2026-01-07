# Runbook: Bug Fix Workflow

This runbook guides you through diagnosing and fixing bugs in the agent-service.

## Prerequisites

1. Read `docs/ai/context.md` for current phase and invariants
2. Read relevant architecture docs in `docs/architecture/`
3. Understand the affected module

## Workflow

### Phase 1: Understand the Bug

#### 1.1 Gather Information

```bash
# Check git log for recent changes
git log --oneline -20

# Check what files were recently modified
git diff HEAD~5 --name-only

# Check current branch status
git status
```

#### 1.2 Reproduce the Issue

```bash
# Start the service
pnpm dev

# Make the failing request
curl -X GET http://localhost:3000/v1/agents/invalid-id

# Check logs
tail -f logs/combined.log
```

#### 1.3 Identify Error Type

| Error Type | Investigation Path |
|------------|---------------------|
| 400 Bad Request | Check validation schema, Zod errors |
| 404 Not Found | Check repository findById, query params |
| 409 Conflict | Check uniqueness constraints, existing data |
| 500 Internal Error | Check logs, stack trace, database errors |

### Phase 2: Locate the Source

#### 2.1 Trace the Request Flow

```
Controller → Service → Repository → Database
     ↓           ↓          ↓           ↓
  Validation  Business   Query     PostgreSQL
     Pipe      Logic    Builder      Error
```

#### 2.2 Search for Relevant Code

```bash
# Find files containing the error message
grep -r "error message text" services/agent-service/src/

# Find the controller handling the route
grep -r "@Get.*route-path" services/agent-service/src/

# Find the service method
grep -r "methodName" services/agent-service/src/
```

#### 2.3 Read the Affected Code

Read files in this order:
1. Controller (find the endpoint)
2. Service (find business logic)
3. Repository (find database query)
4. Entity (find schema/decorators)

### Phase 3: Fix the Bug

#### 3.1 Validation Bug

If the issue is validation:

```typescript
// Before: Zod schema too strict
const Schema = z.object({
  email: z.string().email(), // Fails on empty string
});

// After: Handle optional/nullable correctly
const Schema = z.object({
  email: z.string().email().optional().or(z.literal('')),
});
```

#### 3.2 Query Bug

If the issue is in QueryService or filtering:

```typescript
// Before: Missing type casting for UUID search
qb.where('agent.id ILIKE :search', { search: `%${term}%` });

// After: Cast UUID to text for ILIKE
qb.where('agent.id::text ILIKE :search', { search: `%${term}%` });
```

#### 3.3 Relationship Bug

If the issue is with relations:

```typescript
// Before: Using leftJoinAndSelect with field selection
qb.select(['agent.id']).leftJoinAndSelect('agent.office', 'office');

// After: Use leftJoin + addSelect
qb.select(['agent.id'])
  .leftJoin('agent.office', 'office')
  .addSelect(['office.id', 'office.name']);
```

#### 3.4 Database Error Bug

If the issue is a PostgreSQL error:

```typescript
// Before: Not handling constraint violations
await this.repo.save(entity);

// After: Catch and handle
try {
  await this.repo.save(entity);
} catch (error) {
  if (error instanceof QueryFailedError) {
    handleDatabaseError(error);
  }
  throw error;
}
```

### Phase 4: Write Tests

#### 4.1 Unit Test for the Fix

```typescript
describe('BugFix', () => {
  it('should handle the edge case that caused the bug', async () => {
    // Arrange: Set up the condition that caused the bug
    const invalidInput = { ... };

    // Act: Call the method that was failing
    const result = await service.method(invalidInput);

    // Assert: Verify correct behavior
    expect(result).toBeDefined();
  });

  it('should return proper error for invalid input', async () => {
    await expect(service.method(badInput))
      .rejects.toThrow(ExpectedExceptionType);
  });
});
```

#### 4.2 E2E Test

```typescript
it('should handle the edge case via API', async () => {
  const response = await request(app.getHttpServer())
    .get('/v1/endpoint?problematicParam')
    .expect(200); // or appropriate status

  expect(response.body).toMatchObject({ ... });
});
```

### Phase 5: Verify and Deploy

#### 5.1 Local Verification

```bash
# Run all tests
pnpm test:unit
pnpm test:e2e

# Build to catch type errors
pnpm build

# Manual testing
pnpm dev
curl -X GET http://localhost:3000/v1/endpoint
```

#### 5.2 Commit

```bash
git add -A
git commit -m "fix: resolve issue with [description]

- Root cause: [explain what was wrong]
- Solution: [explain what was fixed]
- Tests: [mention new tests added]

Fixes #ISSUE_NUMBER"
```

## Common Bug Patterns

### Pattern: Type Coercion Failure

**Symptom**: 500 error with PostgreSQL type mismatch

**Cause**: Search value not cast to correct type

**Fix**: Add `::text` cast or validate before query

### Pattern: N+1 Query

**Symptom**: Slow response, many SQL queries in logs

**Cause**: Relations loaded lazily in a loop

**Fix**: Use `leftJoinAndSelect` or explicit relation loading

### Pattern: Null Reference

**Symptom**: "Cannot read property of undefined"

**Cause**: Optional relation assumed to exist

**Fix**: Add null checks or use optional chaining

### Pattern: Validation Bypass

**Symptom**: Invalid data in database

**Cause**: Validation only on DTO, not entity

**Fix**: Add constraints at entity and database level

### Pattern: Race Condition

**Symptom**: Intermittent duplicate entries

**Cause**: Concurrent requests checking before insert

**Fix**: Use database unique constraint + catch conflict

## Debugging Tools

### Enable Query Logging

```typescript
// In data-source.ts or service config
logging: ['query', 'error'],
```

### Add Debug Logging

```typescript
this.logger.debug('Processing request', {
  params: request.params,
  query: request.query,
  body: request.body,
});
```

### Check Database State

```bash
psql -h localhost -p 5432 -U postgres -d agent_database

-- Check table data
SELECT * FROM core.agents WHERE id = 'uuid';

-- Check constraints
SELECT * FROM pg_constraint WHERE conrelid = 'core.agents'::regclass;
```

## Checklist

- [ ] Bug reproduced locally
- [ ] Root cause identified
- [ ] Fix implemented with minimal changes
- [ ] Unit test added for the specific case
- [ ] E2E test added (if API-level bug)
- [ ] Existing tests still pass
- [ ] Build succeeds
- [ ] Manual verification complete
- [ ] Commit message references issue number

## Related Documents

- `docs/architecture/error-handling.md`
- `docs/architecture/query-system.md`
- `.github/instructions/error-handling.instructions.md`
