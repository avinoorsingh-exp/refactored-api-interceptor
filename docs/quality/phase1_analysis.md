# Phase 1 Performance Analysis — Agent List Endpoint

**Date:** 2026-03-13
**Scope:** `GET /v1/agents` — list, filter, search, pagination
**Environment:** dev (ECS Fargate, RDS PostgreSQL, ElastiCache Redis)

---

## Executive Summary

The agent list endpoint serves as the primary data access path for the platform. Performance testing revealed that the original implementation spent 50–80% of response time on `COUNT(*)` queries that ran alongside every paginated data fetch. We implemented a multi-tier count caching strategy that eliminated this overhead, reducing warm response times from 3,600ms+ to under 150ms for the most common query pattern.

However, several structural query performance issues remain that affect filtered and search-based queries. These are not caching problems — they are query design and indexing gaps that require targeted fixes. This document catalogs all findings, the current state of fixes, and the roadmap for resolution.

---

## 1. What Was Fixed

### 1.1 Count Cache (CountCacheService)

**Problem:** Every paginated request ran `getManyAndCount()`, which executes the full data query AND a `SELECT COUNT(*)` over the same result set. For 267K agents with JOINs, the COUNT alone took 2–4 seconds.

**Solution:** Three-tier count caching with background refresh:

| Layer | Mechanism | TTL | Status |
|-------|-----------|-----|--------|
| L1 | In-process LRU (Map) | 30s | Working |
| L2 | Redis (ioredis) | 5 min (exact) / 15s (approximate) | Blocked — Redis unreachable in dev |
| L3a | `pg_class.reltuples` | Used for unfiltered counts | Working |
| L3b | `EXPLAIN (FORMAT JSON)` planner estimate | Used for filtered counts | Working |
| Background | `qb.clone().getCount()` fire-and-forget | Overwrites L1/L2 with exact count | Working |

**Results (local, `search=John`, `include=contactMethod`):**

| Metric | Before | After |
|--------|--------|-------|
| Cold call (first request) | 3,676ms | 168ms |
| Warm call (L1 hit) | 3,676ms | 13ms |
| Count source | Real `COUNT(*)` every time | EXPLAIN estimate → background exact |

### 1.2 QueryBuilder Mutation Safety

**Problem:** `Promise.all([qb.getMany(), countCache.getCount()])` shared the same QueryBuilder instance. The count path mutated the QB (clearing pagination, changing SELECT) while `getMany()` was still using it.

**Fix:** All count operations now call `qb.clone()` before any mutation. Both the EXPLAIN estimate path and the background exact count path clone the QB.

### 1.3 EXPLAIN Estimate Fixes

Three bugs were found and fixed in the EXPLAIN estimate path:

1. **Named parameters:** `getQuery()` returns TypeORM `:named` parameters, but `dataSource.query()` needs PostgreSQL `$1` positional parameters. Fixed by using `getQueryAndParameters()` which returns native SQL + ordered param array.

2. **GROUP BY conflict:** `.select('COUNT(*)', 'cnt')` replaced the SELECT clause but the cloned QB retained GROUP BY/ORDER BY from projections. Fixed by EXPLAINing the original SELECT (without COUNT rewrite) — the top-level `Plan Rows` gives the same estimate.

3. **Pagination not cleared:** TypeORM has two separate pagination mechanisms — `.skip()/.take()` (entity-aware) and `.offset()/.limit()` (raw SQL). The EXPLAIN path was only clearing one. Fixed by clearing both: `.skip(undefined).take(undefined).offset(undefined).limit(undefined)`.

### 1.4 Redis Graceful Degradation

**Problem:** When `REDIS_URL` pointed to an unreachable host, ioredis retried indefinitely, blocking the event loop. When retries exhausted, `cache.set()` threw `MaxRetriesPerRequestError` which propagated to the HTTP response as a 500.

**Fixes:**
- `REDIS_URL` made optional in configuration (was required with a default)
- `enabled: !!redisUrl` flag — when no URL, all cache ops become no-ops
- Retry strategy capped at 3 retries with `return null` to stop
- `maxRetriesPerRequest: 1`, `connectTimeout: 3000ms`
- `cache.set()`, `cache.del()`, `cache.delPattern()` swallow errors (cache is non-critical)
- L1 LRU + EXPLAIN estimates continue working without Redis

### 1.5 CountCacheModule Singleton

**Problem:** `CountCacheModule.register()` was called in multiple modules, creating duplicate service instances.

**Fix:** Converted to `@Global()` + `forRoot()` pattern. Single registration in `AppModule`, available everywhere via DI.

### 1.6 Logger Wiring

**Problem:** CacheService never received a logger — all `this.logger?.` calls were no-ops. Winston logger was `null` at factory time (before `onModuleInit`).

**Fix:** Lazy Proxy pattern that forwards to `loggerService._winston` at call time, falling back to `console` during bootstrap.

---

## 2. Known Performance Issues (Not Yet Fixed)

### 2.1 EXPLAIN Estimate Accuracy

**Severity:** Medium
**Impact:** Incorrect `total` count displayed to users for certain query patterns

The EXPLAIN planner estimate is unreliable for complex queries:

| Query Type | EXPLAIN Estimate | Actual Count | Accuracy |
|------------|-----------------|--------------|----------|
| `search=John` | 9,476 | ~5,000 | Reasonable |
| `lifecycleStatus=Active` | 103,024 | 85,854 | Off by 20% |
| `search=steven.johnstone@exp...` | 133,776 | ~1 | Wildly off |

The planner overestimates OR'd ILIKE conditions and has poor selectivity estimates for long pattern strings and EXISTS subqueries. This is inherent to PostgreSQL's EXPLAIN — it cannot be improved without running the actual query.

**Mitigation:** The background exact count overwrites the estimate within seconds. On subsequent requests (within L1 TTL), the correct count is served. Without Redis, this correction is lost after 30 seconds.

### 2.2 Email Search — Full Table Scan

**Severity:** High
**Impact:** 24.6s response time

**Query:** `?search=steven.johnstone@expsouthafrica.co.za`

When the search term contains `@`, the FTS `search_vector` GIN index is intentionally skipped (emails aren't in the search vector). The query falls back to ILIKE on 6 name columns (all miss) plus an EXISTS correlated subquery on `contact_method.value` — scanning 267K agents.

```sql
WHERE firstName ILIKE '%steven.johnstone@expsouthafrica.co.za%'     -- misses, full scan
   OR lastName ILIKE '%steven.johnstone@expsouthafrica.co.za%'      -- misses, full scan
   OR ...4 more name columns...                                     -- all miss
   OR EXISTS (SELECT 1 FROM contact_method WHERE agent_id = entity.id
              AND value ILIKE '%steven.johnstone@expsouthafrica.co.za%')  -- correlated subquery
```

**Fix required:** When search contains `@`, skip name ILIKE columns entirely — only run the EXISTS on `contact_method.value`. Add a trigram GIN index on `contact_method.value` to accelerate the ILIKE.

### 2.3 Country Filter — 3-Table Correlated Subquery

**Severity:** High
**Impact:** >25s response time (gateway timeout)

**Query:** `?filter=country ilike "usa"`

```sql
AND EXISTS (
  SELECT 1 FROM core.agent_address aa
  JOIN core.address a ON a.id = aa.address_id
  JOIN core.country c ON c.id = a.country_id
  WHERE aa.agent_id = entity.id AND c.name ILIKE '%usa%'
)
```

This runs a 3-table join for every candidate row. With `lifecycleStatus=Active` (~103K rows), that's 103K executions of the subquery.

**Fix required:** Invert the query — find matching country IDs first (tiny set), walk up to agent IDs, then use `IN`:

```sql
WHERE entity.id IN (
  SELECT aa.agent_id FROM core.agent_address aa
  JOIN core.address a ON a.id = aa.address_id
  JOIN core.country c ON c.id = a.country_id
  WHERE c.name ILIKE '%usa%'
)
```

### 2.4 OFFSET Pagination Scaling with Search

**Severity:** Medium
**Impact:** Response time scales linearly with offset depth

| Offset | Duration (search=John) |
|--------|----------------------|
| 0 | 168ms |
| 75 | 2,667ms |

`OFFSET N` forces PostgreSQL to compute and discard N rows before returning results. With search queries involving OR'd ILIKEs and FTS, the entire result set must be re-evaluated from scratch on every page.

**Fix options:**
1. Keyset/cursor pagination for search results (use cursor on `(rank, id)`)
2. Materialized search results — cache matching IDs, paginate over the cached list
3. Cap max offset for search queries (e.g., 1000)

### 2.5 Candidate Set Truncation — Correctness Bug

**Severity:** High (correctness, not performance)
**Impact:** Missing results when combining cheap + expensive filters

The candidate set optimization restricts expensive filters (email EXISTS, country EXISTS) to the first 2,000 agent IDs by UUID order from cheap filters (`lifecycleStatus=Active`). If a matching agent's UUID falls outside this set, it is silently excluded from results.

**Example:** `firstName ilike John AND email ilike John%@exp AND country ilike usa AND lifecycleStatus=Active` — only searches the first 2,000 active agents by UUID, not all ~103K.

**Fix required:** Disable the candidate set when non-cheap standard filters (like `firstName ILIKE`) are present, since the trigram GIN index already narrows the result set efficiently. The candidate set should only activate when the ONLY filters are cheap ones (lifecycleStatus, id) combined with relational EXISTS filters.

### 2.6 Cold Start Latency

**Severity:** Medium
**Impact:** 4–11s on first request after idle period

First request after ECS task spin-up or idle period includes:
- ECS task cold start (container bootstrap, NestJS init)
- DB connection pool establishment (SSL handshake to RDS)
- PostgreSQL buffer cache miss (data pages loaded from disk)

This is infrastructure-level, not application code. Connection pool pre-warming (already implemented, 5 connections) helps but doesn't eliminate the DB buffer cache miss on first query.

---

## 3. Redis — Current State and Impact

Redis (ElastiCache) is configured but **unreachable in dev** due to a networking issue (security group or VPC configuration). The application gracefully degrades — all L2 cache operations are no-ops, and the L1 LRU + EXPLAIN estimates continue working.

**Impact of no Redis:**

| Behavior | With Redis | Without Redis |
|----------|-----------|---------------|
| Count cache TTL | 5 min (L2) | 30s (L1 only) |
| Cross-task cache sharing | Yes (shared L2) | No (each task has own L1) |
| User returns after 2 min | L2 hit (instant) | Cold — re-runs EXPLAIN |
| Background exact count | Stored in L1 + L2 | Stored in L1 only (30s) |

**Action required:** Fix ElastiCache security group to allow inbound from ECS task security group on port 6379. This is an infrastructure task, not a code change.

---

## 4. Load Testing Gaps (k6)

The existing k6 baseline test (`pnpm loadtest:agents:baseline`) has solid foundations — weighted distributions, projection-aware includes, hotspot tracking — but does not cover the query patterns that revealed our performance issues.

### 4.1 Current Coverage

| Dimension | Covered | Notes |
|-----------|---------|-------|
| Basic list (no filters) | Yes | Default `listAgents` call |
| Search (name terms) | Yes | `alice,bob,charlie,smith,jones` |
| Page sizes (10/25/50/100) | Yes | Random distribution |
| Includes (none/light/heavy) | Yes | Weighted 70/25/5 |
| Fields projection | Yes | Weighted default/custom |

### 4.2 Missing Coverage

| Dimension | Gap | Why It Matters |
|-----------|-----|----------------|
| **Structured filters** | `FILTERS` env only supports flat `key:value`, not `conditions` array JSON | Cannot test `lifecycleStatus eq`, `firstName ilike`, `email ilike`, `country ilike`, or combinations |
| **Pagination depth** | `offset` is always `0` | Cannot detect OFFSET scaling regression (2,667ms at offset=75 with search) |
| **Email search** | No `@`-containing search terms | Cannot detect the 24.6s email search path |
| **UUID search** | No UUID search terms | Cannot test the exclusive `andWhere` path |
| **Relational sorts** | No sort testing | Cannot test `primaryEmail` or `licensedStates` sort which trigger JOIN-based ordering |
| **Response body validation** | Only checks `status === 200` | Cannot catch `total: 0` (EXPLAIN bug), empty results (candidate set bug), or server-reported slowness |
| **Warm vs cold** | Every iteration fires immediately | Cannot distinguish cache-hit vs cache-miss performance |
| **Key includes** | Fallback map uses `office`, `mls`, `publicProfile` | Missing `primaryEmail`, `primaryAddress`, `contactMethod` which trigger post-query SQL |

### 4.3 Recommended Improvements

**`params.js` — Filter Model:**
- Add a `buildFilterConditions(module)` function that generates structured filter JSON matching the API's `{conditions: [...], logicalOperator}` format
- Create filter presets: `active-only`, `active-name-search`, `active-email-filter`, `active-country-filter`, `combined`
- Add weighted distribution for filter complexity

**`params.js` — Offset Distribution:**
- Add `OFFSET_SET` env var (default: `0,25,50,100,200,500`)
- Weighted toward low offsets: `0:50,25:20,50:15,100:10,200:4,500:1`

**`params.js` — Search Terms:**
- Add email-format terms: `john@exp`, `steven.johnstone@expsouthafrica.co.za`
- Add UUID terms for exclusive search path
- Add multi-word terms: `John Smith`, `Alice Johnson`

**`agents/journey.js` — Response Validation:**
```javascript
check(res, {
  'agents list 200': (r) => r.status === 200,
  'has results': (r) => JSON.parse(r.body).data.length > 0,
  'total > 0': (r) => JSON.parse(r.body).meta.total > 0,
  'server duration < 5s': (r) => JSON.parse(r.body).meta.query.performance.durationMs < 5000,
});
```

**`agents-baseline.js` — Include Presets:**
- Override agents includes to use the known-slow combinations: `primaryEmail,primaryAddress` (light), `primaryEmail,primaryAddress,contactMethod,licensedStates` (heavy)

---

## 5. Recommended Fix Priority

| # | Issue | Severity | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | Fix Redis connectivity (security group) | High | Low | Extends count cache to 5 min, cross-task sharing |
| 2 | Candidate set correctness bug | High | Low | Results are silently truncated — wrong data returned |
| 3 | Email search: skip name ILIKEs when `@` present | High | Low | 24.6s → <500ms |
| 4 | Country filter: invert to subquery-first | High | Medium | >25s timeout → <1s |
| 5 | k6 filter/offset/search coverage | Medium | Medium | Catches regressions before deploy |
| 6 | k6 response body validation | Medium | Low | Catches correctness bugs (total=0, empty results) |
| 7 | OFFSET pagination cap or cursor for search | Medium | Medium | Prevents linear degradation on deep pages |

---

## 6. Performance Benchmarks (Current State)

All measurements taken against dev environment (ECS Fargate, RDS PostgreSQL).

### Fast Path (working well)

| Query | Cold | Warm | Notes |
|-------|------|------|-------|
| No filters, no search | 4.3s | 7ms | Cold = ECS/DB warmup |
| `search=John` | 256ms | 13ms | FTS + trigram, count cached |
| `lifecycleStatus=Active` | 258ms | 258ms | Btree index, large result set |
| `firstName ilike John + lifecycleStatus=Active` | 4.8s | <100ms | Cold = buffer cache miss |

### Slow Path (needs fixes)

| Query | Duration | Root Cause |
|-------|----------|------------|
| `search=email@domain.com` | 24.6s | Full table scan — FTS disabled, 6 ILIKE misses + EXISTS |
| `country ilike usa` | >25s (timeout) | 3-table correlated subquery × 103K rows |
| `search=John` at offset=200 | 2.6s | OFFSET re-evaluates full result set |
| Combined filters (name+email+country) | >25s | Candidate set limits to 2K rows + country EXISTS |

---

## 7. Architecture Diagram — Count Cache Flow

```
Request → Controller → Repository.findPage()
                            │
                            ├─ Promise.all([
                            │     qb.getMany()          ← data query (25 rows)
                            │     countCache.getCount()  ← count (fast path below)
                            │  ])
                            │
                            ▼
                    CountCacheService.getCount()
                            │
                    ┌───────┼───────────┐
                    ▼       ▼           ▼
                 L1 LRU   L2 Redis   L3 Estimate
                 (30s)    (5 min)    (pg_class or EXPLAIN)
                    │       │           │
                    │       │           ├─ No filters → pg_class.reltuples
                    │       │           └─ Filters → EXPLAIN (FORMAT JSON)
                    │       │                           │
                    │       │                    Background job:
                    │       │                    qb.clone().getCount()
                    │       │                    overwrites L1 + L2
                    │       │                    with exact count
                    ▼       ▼
                 Return { count, isApproximate, source }
```
