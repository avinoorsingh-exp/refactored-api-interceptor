# Runbook: Query Performance Tuning

## When to Use

- API response times exceed acceptable thresholds (>2s for list endpoints)
- CloudWatch / application logs show `[Microscope] SLOW query` or `[Microscope] CRITICAL query`
- Users report slow page loads on agent grids or search

## Prerequisites

- Access to environment variables for the target deployment (dev/test/prod)
- Access to application logs (CloudWatch, Datadog, etc.)
- Familiarity with PostgreSQL EXPLAIN output

## Step 1: Check Current Configuration

The `QueryPerformanceInterceptor` (Microscope) is controlled by these env vars:

| Variable | Default | Description |
|---|---|---|
| `PERF_QUERY_MODE` | `query` | `query` / `perf` / `off` |
| `PERF_QUERY_SLOW_MS` | `2000` | Slow threshold (ms) |
| `PERF_QUERY_CRITICAL_MS` | `10000` | Critical threshold (ms) |
| `PERF_QUERY_CAPTURE_EXPLAIN` | `off` | When to run EXPLAIN ANALYZE |
| `PERF_QUERY_SAMPLE_RATE` | `0.1` (deployed) | Fraction of requests instrumented |
| `PERF_QUERY_INCLUDE_IN_RESPONSE` | `false` | Show SQL in response body |

If `PERF_QUERY_MODE` is `off`, no performance data is captured. Set it to `query` first.

## Step 2: Identify the Slow Query

### From application logs

Search logs for `[Microscope] SLOW query` or `[Microscope] CRITICAL query`. The log entry includes:

```json
{
  "channel": "diagnostic",
  "correlationId": "1709571592770-abc123def",
  "endpoint": { "method": "GET", "path": "/v1/agents?include=contactMethod" },
  "perf": { "durationMs": 5200, "thresholdMs": 2000, "severity": "slow" },
  "query": { "sql": "SELECT ... (truncated)" },
  "pool": { "total": 10, "idle": 3, "active": 7, "waiting": 0 }
}
```

### From response headers

Every instrumented request includes `X-Response-Time` and `X-Correlation-ID` headers.
Use the correlation ID to find the matching log entry.

### From response body (local/debug only)

Set `PERF_QUERY_INCLUDE_IN_RESPONSE=true` to see SQL in `meta.query.performance.sql`.
**Never enable this in production** — it exposes SQL to API consumers.

## Step 3: Enable EXPLAIN (Temporarily)

To get an execution plan for slow queries:

```bash
# Enable EXPLAIN for queries exceeding the critical threshold (10s)
PERF_QUERY_CAPTURE_EXPLAIN=critical

# Or for all slow queries (>2s) — use with caution
PERF_QUERY_CAPTURE_EXPLAIN=slow
```

**WARNING**: `EXPLAIN (ANALYZE)` **re-executes the query**, doubling response time. A 5s query
becomes 10s+. This can push requests past gateway timeouts (typically 30-60s). Only enable
temporarily, then set back to `off`.

The EXPLAIN result appears in application logs:

```json
{
  "explain": {
    "executionTimeMs": 4800,
    "planningTimeMs": 12,
    "hasSeqScan": true,
    "estimatedRows": 1000,
    "actualRows": 267452,
    "nodeTypes": ["Seq Scan", "Hash Join", "Sort"]
  },
  "warnings": [
    "PERF: Sequential scan detected - consider adding indexes",
    "STATS: Row estimate off by 266452 rows - run ANALYZE on table"
  ]
}
```

## Step 4: Diagnose Common Issues

### Sequential scan on large table

**Symptom**: `hasSeqScan: true` with `actualRows > 10000`

**Fix**: Add an index on the WHERE/ORDER BY columns:
```sql
CREATE INDEX CONCURRENTLY idx_agent_lifecycle_status ON core.agent (lifecycle_status);
```

### Row estimate mismatch

**Symptom**: `estimatedRows` is far from `actualRows`

**Fix**: Update PostgreSQL statistics:
```sql
ANALYZE core.agent;
ANALYZE core.contact_method;
```

### JOIN inflation in COUNT query

**Symptom**: COUNT query takes as long as data query despite LIMIT 25

**Cause**: `getManyAndCount()` includes all LEFT JOINs in both the data query and the COUNT query.
A 1:N join (e.g., contactMethod with 0-50 rows per agent) forces the COUNT to process millions of
joined rows.

**Fix**: Move the relation to post-query loading:
1. Strip the relation from the `include` passed to ProjectionService
2. Run the pagination query without the JOIN (COUNT becomes `SELECT COUNT(*) FROM agent WHERE ...`)
3. Load the relation data in a second query: `WHERE agent_id = ANY($1)` with the page's 25 IDs

This pattern is already implemented for: `contactMethod`, `primaryEmail`, `primaryPhone`,
`primaryAddress`, `licensedStates`.

### EXPLAIN doubling response time

**Symptom**: Slow queries started timing out after enabling monitoring

**Cause**: `PERF_QUERY_CAPTURE_EXPLAIN=slow` re-executes every slow query

**Fix**: Set `PERF_QUERY_CAPTURE_EXPLAIN=off` (the default). Only enable temporarily.

### Connection pool exhaustion

**Symptom**: `pool.waiting > 0` or `pool.active == pool.total`

**Fix**: Check for long-running queries holding connections. Consider increasing pool size
or adding query timeouts.

## Step 5: Verify Fix

After applying a fix:

1. Redeploy with `PERF_QUERY_CAPTURE_EXPLAIN=off`
2. Test the affected endpoint:
   ```bash
   curl -s -o /dev/null -w "%{http_code} %{time_total}s" \
     "https://<env>-agent-service-orch.exprealty.com/v1/agents?limit=25&include=contactMethod,primaryAddress"
   ```
3. Check application logs for absence of `[Microscope] SLOW query` entries
4. Monitor over 24h for regression

## Quick Reference: Safe Production Settings

```bash
PERF_QUERY_MODE=query
PERF_QUERY_SLOW_MS=2000
PERF_QUERY_CRITICAL_MS=10000
PERF_QUERY_LOG_ALL=false
PERF_QUERY_INCLUDE_IN_RESPONSE=false
PERF_QUERY_CAPTURE_EXPLAIN=off
PERF_QUERY_SAMPLE_RATE=0.1
```
