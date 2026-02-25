# Phase 2: Load Test Harness

Standardized k6 load-test scenarios with shared config, reusable journeys, and Jira-friendly artifact generation.

---

## Architecture

```
apps/load-test/
  src/
    lib/
      config.js          # Shared config — BASE_URL, AUTH_MODE, env vars
      http.js            # HTTP wrapper — auth headers, standard tags
      k6-constants.js    # Threshold profiles + trend stats
    agents/
      journey.js         # Reusable agent request sequences
    agent-companies/
      journey.js         # Agent-company request sequences
    companies/
      journey.js         # Company request sequences
    scenarios/
      smoke.js           # Quick validation (3 VUs, 45s)
      baseline.js        # Steady-state (10 VUs, ~2.5 min)
      stress.js          # Ramp to 50 VUs (~5 min)
      agents.js           # Legacy per-module scenarios (unchanged)
      agent-companies.js  # ...
      ...
  scripts/
    generate-report.mjs  # Post-run artifact generator (md + html)
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `BASE_URL` | Target service URL | `http://localhost:3000` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV` | `local` | Environment label (local/dev/stage) |
| `AUTH_MODE` | `none` | Auth strategy: `none`, `bearer`, `apikey` |
| `AUTH_TOKEN` | — | Bearer token (when `AUTH_MODE=bearer`) |
| `API_KEY` | — | API key (when `AUTH_MODE=apikey`) |
| `RUN_ID` | auto | Override auto-generated run ID |
| `K6_P95_MS` | varies | p95 latency threshold (ms) |
| `K6_P99_MS` | varies | p99 latency threshold (ms) |
| `K6_ERR_RATE` | `0.01` | Max error rate (decimal, e.g. `0.05` = 5%) |

---

## Scenarios

### Smoke

Quick validation that key endpoints are alive. Strict latency, low VUs.

```bash
pnpm loadtest:smoke
# or
BASE_URL=http://localhost:3000 ./scripts/run-k6.sh smoke
```

| Parameter | Value |
|-----------|-------|
| VUs | 3 |
| Duration | ~45s |
| p95 threshold | 1000ms |
| Error rate | < 1% |

### Baseline

Steady-state performance measurement. Moderate VUs, tighter latency.

```bash
pnpm loadtest:baseline
# or
BASE_URL=http://localhost:3000 ./scripts/run-k6.sh baseline
```

| Parameter | Value |
|-----------|-------|
| VUs | 10 |
| Duration | ~2.5 min |
| p95 threshold | 500ms |
| p99 threshold | 1500ms |
| Error rate | < 1% |

### Stress

Ramp to high VUs. Gates on error rate; latency thresholds are advisory.

```bash
pnpm loadtest:stress
# or
BASE_URL=http://localhost:3000 ./scripts/run-k6.sh stress
```

| Parameter | Value |
|-----------|-------|
| Max VUs | 50 |
| Duration | ~5 min |
| p95 threshold | 3000ms (advisory) |
| Error rate | < 5% |

---

## Agents-Only Scenarios

Dedicated scenarios that **only** hit the Agents module routes. Useful for isolating agent query performance.

### Commands

```bash
# Smoke — quick health check
BASE_URL=http://localhost:3000 pnpm loadtest:agents:smoke

# Baseline — steady-state with weighted params
BASE_URL=http://localhost:3000 pnpm loadtest:agents:baseline

# Stress — ramp to 50 VUs, worst-case params
BASE_URL=http://localhost:3000 pnpm loadtest:agents:stress
```

### Endpoints Hit

| Endpoint | Journey Function |
|----------|-----------------|
| `GET /v1/agent/health` | `healthCheck()` |
| `GET /v1/agents` | `listAgents(params)` |

### Example: Agents-Focused `.env.loadtest.local`

```bash
BASE_URL=http://localhost:3000
AGENTS_INCLUDES=mix
AGENTS_INCLUDES_WEIGHTS=none:40,light:35,heavy:25
AGENTS_FIELDS_MODE=mix
AGENTS_FIELDS_WEIGHTS=default:60,custom:40
AGENTS_FIELDS_COUNT_SET=5,10,15,20
SEARCH_MODE=mix
```

### Example: Worst-Case One-Liner

```bash
BASE_URL=http://localhost:3000 SEARCH_MODE=contains INCLUDES=heavy \
  FIELDS_MODE=custom FIELDS_COUNT_SET=20 PAGE_SIZE_SET=100 \
  pnpm loadtest:agents:stress
```

### Scenario Tags

Each agents-only scenario sets its scenario tag explicitly:

| Script | Scenario Tag |
|--------|-------------|
| `loadtest:agents:smoke` | `agents-smoke` |
| `loadtest:agents:baseline` | `agents-baseline` |
| `loadtest:agents:stress` | `agents-stress` |

These appear in hotspot metrics, regression reports, and k6 summary output.

---

## Endpoints Hit (Generic Scenarios)

All three generic scenarios hit the same endpoints:

| Endpoint | Journey Function | Module |
|----------|-----------------|--------|
| `GET /v1/agent/health` | `healthCheck()` | agents |
| `GET /v1/agents` | `listAgents()` | agents |
| `GET /v1/agent-companies` | `listAgentCompanies()` | agent-companies |
| `GET /v1/companies` | `listCompanies()` | companies |

---

## Running Load Tests

### Via Root Scripts (recommended — produces artifacts)

```bash
# Smoke (default)
pnpm loadtest:smoke

# Baseline
pnpm loadtest:baseline

# Stress
pnpm loadtest:stress

# Against a non-local target
BASE_URL=https://dev.example.com pnpm loadtest:smoke

# With custom thresholds
K6_P95_MS=2000 K6_ERR_RATE=0.05 pnpm loadtest:baseline

# With extra k6 flags
BASE_URL=http://localhost:3000 ./scripts/run-k6.sh smoke --vus 5
```

### Via Load-Test Workspace (interactive, no artifacts)

```bash
pnpm --filter @exprealty/load-test smoke
pnpm --filter @exprealty/load-test baseline
pnpm --filter @exprealty/load-test stress
```

### Legacy Per-Module Scenarios

The original per-module scenarios are still available:

```bash
pnpm --filter @exprealty/load-test k6:agents
pnpm --filter @exprealty/load-test k6:agent-companies
pnpm --filter @exprealty/load-test k6:all
```

---

## Artifact Output

When using `pnpm loadtest:*` or `./scripts/run-k6.sh`, every run produces:

```
artifacts/k6/<runid>/
  k6-summary.json    # k6 end-of-test summary (metrics, thresholds, checks)
  k6-summary.md      # Jira-friendly markdown table
  k6-report.html     # Self-contained HTML report
  k6.log             # Full console output
```

The `runid` format is `YYYYMMDDTHHMMSS-<git-short-sha>`.

### Jira-Friendly Markdown (`k6-summary.md`)

Contains:
- Scenario name, base URL, overall PASS/FAIL status
- Total requests, max VUs, error rate
- Latency table: avg, p50, p90, p95, p99, max
- Per-threshold PASS/FAIL breakdown

Copy-paste directly into Jira comments or PR descriptions.

### HTML Report (`k6-report.html`)

Self-contained single-file HTML with the same data, styled for browser viewing. Attach to Jira tickets or share via Slack.

### Important: Threshold Failures

Artifacts are **always generated**, even when k6 exits non-zero due to threshold failures. The script captures the exit code, generates reports, then exits with the original code. This means CI pipelines can collect artifacts from failed runs for debugging.

---

## Shared Libraries

### `src/lib/config.js`

Centralized config from `__ENV` variables. Fails fast if `BASE_URL` is missing. Provides `getAuthHeaders()` and `sanitizeBaseUrl()` for safe logging.

### `src/lib/http.js`

Wraps `k6/http` methods (`get`, `post`, `put`, `patch`, `del`) with:
- Automatic auth headers based on `AUTH_MODE`
- Standard tags on every request: `service`, `module`, `endpoint`, `operation`, `scenario`, `method`, `env`
- `buildUrl()` helper for consistent URL construction

### `src/lib/k6-constants.js`

Exports `smokeProfile`, `baselineProfile`, `stressProfile` — each containing `stages`, `thresholds`, and `summaryTrendStats`. Thresholds are overridable via env vars (`K6_P95_MS`, `K6_P99_MS`, `K6_ERR_RATE`).

---

## Adding New Journeys

1. Create `src/<module>/journey.js`:

```javascript
import { check, sleep } from 'k6';
import { get } from '../lib/http.js';

const MODULE = 'my-module';

export function listMyModule() {
  const res = get('/v1/my-module', { module: MODULE, operation: 'list' });
  check(res, { 'my-module list 200': (r) => r.status === 200 });
  sleep(0.5);
  return res;
}
```

2. Import and call in `src/scenarios/smoke.js`, `baseline.js`, `stress.js`:

```javascript
import { listMyModule } from '../my-module/journey.js';

export default function () {
  // ... existing calls ...
  listMyModule();
}
```

---

## Script Reference

| Script | Description |
|--------|-------------|
| `pnpm loadtest:smoke` | Smoke test with artifact generation |
| `pnpm loadtest:baseline` | Baseline test with artifact generation |
| `pnpm loadtest:stress` | Stress test with artifact generation |
| `pnpm loadtest:agents:smoke` | Agents-only smoke test |
| `pnpm loadtest:agents:baseline` | Agents-only baseline test |
| `pnpm loadtest:agents:stress` | Agents-only stress test |
| `./scripts/run-k6.sh <scenario>` | Run any scenario with artifacts |
| `pnpm --filter @exprealty/load-test smoke` | Direct k6 run (no artifacts) |
| `pnpm --filter @exprealty/load-test k6:agents` | Legacy per-module scenario |
