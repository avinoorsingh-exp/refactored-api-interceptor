# Phase 2.1: Request Parameterization & Microscope Mode

Extends the k6 harness with configurable request shapes and adds env-controlled query performance instrumentation for dev/stage load testing.

---

## Part A: k6 Request Parameterization

### Overview

Load test requests are now configurable so you can isolate performance issues tied to:
- **Paging** — page size, offset
- **Search** — ILIKE patterns (prefix, contains, exact)
- **Filters** — arbitrary key/value pairs
- **Includes** — none, light, heavy relation loading

Each scenario type uses a different parameter strategy:
- **Smoke** — fixed, deterministic (default page size, no search, no includes)
- **Baseline** — weighted distribution of page sizes, search modes, and includes levels
- **Stress** — worst-case defaults (contains search + heavy includes + largest page size)

### Environment Variables

All optional — safe defaults used when missing.

| Variable | Default | Description |
|----------|---------|-------------|
| `PAGE_SIZE` | `25` | Default page size for smoke tests |
| `PAGE_SIZE_SET` | `10,25,50,100` | Comma list of page sizes for baseline/stress distribution |
| `SEARCH_MODE` | `prefix` | Search mode: `prefix`, `contains`, `exact`, or `mix` (weighted) |
| `SEARCH_TERMS` | `alice,bob,charlie,smith,jones` | Comma list of search terms |
| `INCLUDES` | `none` | Includes level: `none`, `light`, `heavy`, or `mix` (weighted) |
| `FILTERS` | *(empty)* | Comma list of `key:value` pairs, e.g. `status:active,region:west` |
| `INCLUDES_WEIGHTS` | `none:70,light:25,heavy:5` | Weighted distribution for `INCLUDES=mix` |
| `SEARCH_WEIGHTS` | `prefix:60,contains:30,exact:10` | Weighted distribution for `SEARCH_MODE=mix` |

### Includes Level Mapping

| Level | Agents (`include=`) | Companies | Agent-Companies |
|-------|-------------------|-----------|-----------------|
| `none` | *(empty)* | *(empty)* | *(empty)* |
| `light` | `office` | *(empty)* | *(empty)* |
| `heavy` | `mls,office,publicProfile` | *(empty)* | *(empty)* |

Extend the `INCLUDES_MAP` in `apps/load-test/src/lib/params.js` as new include options become available per module.

### Request Tagging

Every parameterized request includes tags that identify the variant:

| Tag | Example Values | Purpose |
|-----|---------------|---------|
| `pageSize` | `10`, `25`, `50`, `100` | Page size bucket |
| `searchMode` | `none`, `prefix`, `contains`, `exact` | Search strategy used |
| `includesLevel` | `none`, `light`, `heavy` | Relation loading level |
| `hasFilters` | `yes`, `no` | Whether filters were applied |

These tags appear in k6 output, allowing you to see exactly which variant regressed.

### Examples

```bash
# Default smoke (no search, no includes, pageSize=25)
BASE_URL=http://localhost:3000 pnpm loadtest:smoke

# Baseline with mixed search and includes
BASE_URL=http://localhost:3000 \
  SEARCH_MODE=mix INCLUDES=mix \
  pnpm loadtest:baseline

# Stress with worst-case params
BASE_URL=http://localhost:3000 \
  SEARCH_MODE=contains INCLUDES=heavy PAGE_SIZE_SET=100 \
  SEARCH_TERMS=john,smith,anderson,williams \
  pnpm loadtest:stress

# Targeted: isolate large page size regression
BASE_URL=http://localhost:3000 \
  PAGE_SIZE=100 INCLUDES=none SEARCH_MODE=prefix \
  pnpm loadtest:baseline

# Targeted: isolate ILIKE contains search
BASE_URL=http://localhost:3000 \
  PAGE_SIZE=25 SEARCH_MODE=contains SEARCH_TERMS=john \
  INCLUDES=none \
  pnpm loadtest:baseline

# Targeted: isolate heavy includes
BASE_URL=http://localhost:3000 \
  PAGE_SIZE=25 SEARCH_MODE=prefix INCLUDES=heavy \
  pnpm loadtest:baseline

# With filters
BASE_URL=http://localhost:3000 \
  FILTERS=status:active,region:west \
  pnpm loadtest:baseline
```

---

## Part B: Microscope Mode (Query Performance Instrumentation)

### Overview

Replaces the previous `NODE_ENV === 'local'` switching with explicit env flags so you can enable detailed query performance logging during dev/stage load tests without code changes.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PERF_QUERY_MODE` | `off` (non-local), `query` (local) | `off` = no perf interceptors, `perf` = timing only, `query` = full SQL capture |
| `PERF_QUERY_INCLUDE_IN_RESPONSE` | `false` | Include query metadata in response body |
| `PERF_QUERY_LOG_ALL` | `false` | Log every request (not just slow ones) |
| `PERF_QUERY_CAPTURE_EXPLAIN` | `slow` | When to run EXPLAIN ANALYZE: `off`, `slow`, `critical`, `all` |
| `PERF_QUERY_SAMPLE_RATE` | `1.0` (local), `0.01` (non-local) | Fraction of requests to instrument (0.0–1.0) |
| `PERF_QUERY_ENDPOINT_ALLOWLIST` | *(empty = all)* | Comma-separated path prefixes to instrument, e.g. `/v1/agents,/v1/companies` |
| `PERF_QUERY_SLOW_MS` | `2000` | Threshold for "slow" query warning (ms) |
| `PERF_QUERY_CRITICAL_MS` | `10000` | Threshold for "critical" query error (ms) |

### Mode Behavior

| Mode | Interceptor | SQL Capture | EXPLAIN | Response Metadata | Overhead |
|------|------------|-------------|---------|-------------------|----------|
| `off` | None (header fix only) | No | No | No | Minimal |
| `perf` | PerformanceInterceptor | No | No | Optional (timing only) | Low |
| `query` | QueryPerformanceInterceptor | Yes (sampled) | Configurable | Optional (full) | Medium |

### Sampling & Allowlisting

When `PERF_QUERY_MODE=query`:
- **Sample rate**: Only `PERF_QUERY_SAMPLE_RATE` fraction of requests get full instrumentation (SQL capture, EXPLAIN). Non-sampled requests still get timing headers.
- **Endpoint allowlist**: If set, only requests to matching path prefixes are instrumented. Others are skipped entirely.
- These two filters combine: a request must pass both the random sample check AND the allowlist to be instrumented.

### EXPLAIN Capture Modes

| Mode | When EXPLAIN runs |
|------|------------------|
| `off` | Never |
| `slow` | Only when request duration >= `PERF_QUERY_SLOW_MS` |
| `critical` | Only when request duration >= `PERF_QUERY_CRITICAL_MS` |
| `all` | Every instrumented request |

### Log Output

When instrumented, slow/critical queries log:
- Correlation ID (from `x-correlation-id` header or auto-generated)
- Route path + HTTP method
- Total request duration (ms)
- Normalized SQL (comments stripped, whitespace normalized, truncated to 2000 chars)
- Parameter values (truncated to 100 chars each — no secrets in SQL params)
- EXPLAIN output: execution time, planning time, seq scan detection, row estimate mismatches
- Connection pool metrics (total, idle, active, waiting)
- Performance warnings (seq scan, row mismatch, high planning time, app overhead)

### Response Metadata (when enabled)

When `PERF_QUERY_INCLUDE_IN_RESPONSE=true`, list endpoints return:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "count": 25,
    "query": {
      "pagination": { "offset": 0, "limit": 25 },
      "search": "alice",
      "performance": {
        "durationMs": 45,
        "timestamp": "2026-02-24T15:00:00.000Z",
        "connectionPool": { "total": 10, "idle": 8, "active": 2, "waiting": 0 }
      }
    }
  }
}
```

SQL, parameters, and EXPLAIN are stripped from the response unless `PERF_QUERY_INCLUDE_IN_RESPONSE=true`.

### Safety

- **No secrets logged**: SQL parameters are truncated, no credential fields captured
- **Sampling prevents overload**: Default 1% in non-local environments
- **EXPLAIN is gated**: Only runs for slow/critical queries by default, never for every request in prod-like envs
- **ResponseHeaderFixInterceptor always runs last**: Regardless of mode

---

## Recommended Dev/Stage Settings

### (a) Normal baseline run (minimal overhead)

```bash
# .env or ECS task definition
PERF_QUERY_MODE=perf
PERF_QUERY_SAMPLE_RATE=1.0
PERF_QUERY_SLOW_MS=2000
PERF_QUERY_LOG_ALL=false
```

k6 command:
```bash
BASE_URL=https://dev.example.com pnpm loadtest:baseline
```

### (b) Microscope rerun after regression

```bash
# .env or ECS task definition
PERF_QUERY_MODE=query
PERF_QUERY_SAMPLE_RATE=0.05
PERF_QUERY_CAPTURE_EXPLAIN=critical
PERF_QUERY_ENDPOINT_ALLOWLIST=/v1/agents,/v1/companies
PERF_QUERY_SLOW_MS=1000
PERF_QUERY_CRITICAL_MS=5000
PERF_QUERY_LOG_ALL=false
PERF_QUERY_INCLUDE_IN_RESPONSE=false
```

k6 worst-case rerun:
```bash
BASE_URL=https://dev.example.com \
  SEARCH_MODE=contains INCLUDES=heavy PAGE_SIZE_SET=100 \
  SEARCH_TERMS=john,smith,anderson,williams \
  pnpm loadtest:stress
```

### (c) Local development (default behavior, no config needed)

```bash
# Automatically uses PERF_QUERY_MODE=query, PERF_QUERY_SAMPLE_RATE=1.0
# when NODE_ENV=local and no PERF_QUERY_* vars are set
pnpm dev:agent
```

---

## Files Changed/Created

### Part A (k6 parameterization)

| File | Status | Description |
|------|--------|-------------|
| `apps/load-test/src/lib/params.js` | **New** | Request parameter model, generators, query string builder, tag builder |
| `apps/load-test/src/agents/journey.js` | Modified | Accepts optional `params`, appends query string, adds variant tags |
| `apps/load-test/src/agent-companies/journey.js` | Modified | Same pattern |
| `apps/load-test/src/companies/journey.js` | Modified | Same pattern |
| `apps/load-test/src/scenarios/smoke.js` | Modified | Uses `smokeParams()` — fixed, deterministic |
| `apps/load-test/src/scenarios/baseline.js` | Modified | Uses `baselineParams()` — weighted distribution |
| `apps/load-test/src/scenarios/stress.js` | Modified | Uses `stressParams()` — worst-case defaults |

### Part B (microscope mode)

| File | Status | Description |
|------|--------|-------------|
| `services/agent-service/src/core/configuration.ts` | Modified | Added 8 `PERF_QUERY_*` env vars to ConfigSchema |
| `services/agent-service/src/core/config.service.ts` | Modified | Added 8 keys to `buildConfig()` fallback |
| `services/agent-service/src/main.ts` | Modified | Replaced NODE_ENV check with PERF_QUERY_MODE switching |
| `services/agent-service/src/common/interceptors/query-performance.interceptor.ts` | Modified | Added `sampleRate`, `endpointAllowlist`, enum-based `captureExplain` |

### Documentation

| File | Status |
|------|--------|
| `docs/quality/phase2_1.md` | **New** — this file |
