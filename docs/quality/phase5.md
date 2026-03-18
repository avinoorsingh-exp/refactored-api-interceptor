# Phase 5: Performance Trend Tracking & Regression Detection

Compares k6 summaries against a stored baseline to detect latency regressions — both at the global level and per curated hotspot endpoint/variant.

---

## Architecture

```
k6 run
  ↓ produces
artifacts/k6/<runid>/k6-summary.json   (includes hs_* custom Trend metrics)
  ↓ compare against
artifacts-history/k6/<env>/<scenario>/baseline.json   (local baseline)
  ↓ produces
artifacts/k6/<runid>/regression.json   (machine-readable)
artifacts/k6/<runid>/regression.md     (Jira-ready)
```

---

## Quick Start (Local Workflow)

```bash
# 1. Run a baseline test
BASE_URL=http://localhost:3000 pnpm loadtest:baseline

# 2. Save it as the baseline
pnpm perf:baseline:save -- --env local --scenario baseline

# 3. Make changes to the service...

# 4. Run again and compare
PERF_COMPARE=true BASE_URL=http://localhost:3000 pnpm loadtest:baseline
# → regression.md + regression.json appear in the run artifacts

# Or compare manually against any run:
pnpm perf:compare -- --env local --scenario baseline
```

---

## Hotspot Metrics

### The Problem

k6 `--summary-export` does not provide per-tag latency breakdown. Tags like `pageSize=100` or `includesLevel=heavy` only appear in the real-time output, not in the summary JSON.

### The Solution

We create **curated custom Trend metrics** for a bounded set of hotspot endpoints and variant dimensions. These appear in the summary JSON and enable per-endpoint/variant regression detection.

### Metric Naming

```
hs_{endpoint}                    — aggregate per endpoint
hs_{endpoint}_inc_{level}        — includes dimension (none|light|heavy)
hs_{endpoint}_search_{mode}      — search mode dimension (none|prefix|contains|exact)
hs_{endpoint}_ps_{bucket}        — page size dimension (10|25|50|100)
```

### Configuring Hotspot Endpoints

```bash
# Default (3 endpoints × 12 variants = 36 metrics)
PERF_HOTSPOT_ENDPOINTS="GET /v1/agents,GET /v1/companies,GET /v1/agent-companies"

# Add more endpoints (bounded!)
PERF_HOTSPOT_ENDPOINTS="GET /v1/agents,GET /v1/companies,GET /v1/agent-companies,GET /v1/offices"
```

### Avoiding Metric Explosion

Cardinality is bounded by design:
- Endpoints: only those in `PERF_HOTSPOT_ENDPOINTS` (default 3)
- Includes: fixed set of `none`, `light`, `heavy` (3)
- Search modes: fixed set of `none`, `prefix`, `contains`, `exact` (4)
- Page sizes: fixed set of `10`, `25`, `50`, `100` (4)
- Per endpoint: 1 + 3 + 4 + 4 = 12 metrics
- Total at default: 3 × 12 = 36 metrics

Non-hotspot endpoints and non-standard variant values are silently ignored.

---

## Regression Rules

| Metric | Threshold | Type | Env Var |
|--------|-----------|------|---------|
| Global p95 latency | +15% drift | Percentage | `REGRESS_P95_PCT` |
| Global p99 latency | +20% drift | Percentage | `REGRESS_P99_PCT` |
| Error rate | +0.5pp drift | Absolute | `REGRESS_ERR_ABS` |
| Hotspot p95 latency | +20% drift | Percentage | `REGRESS_HOTSPOT_P95_PCT` |

### Tuning Thresholds

```bash
# Tighter thresholds for critical paths
REGRESS_P95_PCT=10 REGRESS_HOTSPOT_P95_PCT=15 pnpm perf:compare -- --env dev --scenario baseline

# Looser thresholds for stress tests (expected variance)
REGRESS_P95_PCT=25 REGRESS_P99_PCT=30 pnpm perf:compare -- --env dev --scenario stress
```

---

## Regression Outputs

### regression.md (Jira-Ready)

Paste directly into Jira comments or PR descriptions:

```markdown
# Performance Regression Report

| Field | Value |
|-------|-------|
| Status | **REGRESSION DETECTED** |
| Environment | dev |
| Scenario | baseline |
| Regressions | 3 |

## Global Metrics
| Metric | Baseline | Current | Drift | Threshold | Result |
...

## Hotspot Endpoints
| Metric | p95 Base | p95 Curr | p95 Drift | ... | Result |
...

## Top Regressions
- **hs_agents_search_contains** p(95): +55.0% (threshold: +20%)
- **hs_agents_inc_heavy** p(95): +52.0% (threshold: +20%)
```

### regression.json (Machine-Readable)

Contains all diffs, flags, and metadata for CI/CD integration.

---

## Local History

### Directory Structure

```
artifacts-history/        # gitignored
  k6/
    <env>/
      <scenario>/
        baseline.json     # saved baseline summary
        runs/
          <runid>.json    # optional saved run summaries
```

### Commands

```bash
# Save current run as baseline
pnpm perf:baseline:save -- --env dev --scenario baseline

# Save a run to history
pnpm --filter @exprealty/load-test perf:run:save -- --env dev --scenario baseline

# List saved runs
pnpm --filter @exprealty/load-test perf:runs -- --env dev --scenario baseline

# Compare latest run against baseline
pnpm perf:compare -- --env dev --scenario baseline

# Compare a specific run
pnpm perf:compare -- --current artifacts/k6/<runid>/k6-summary.json --env dev --scenario baseline
```

---

## S3 Workflow

For sharing baselines across machines/CI.

### Prerequisites

```bash
export PERF_S3_BUCKET=my-perf-bucket
# Optional:
export PERF_S3_PREFIX=perf/k6    # default
export PERF_S3_REGION=us-east-1  # optional
```

Requires AWS CLI (`aws`) and valid credentials (env vars, `~/.aws/credentials`, or IAM role).

### S3 Key Layout

```
s3://<bucket>/<prefix>/<env>/<scenario>/baseline.json
s3://<bucket>/<prefix>/<env>/<scenario>/<runid>.json
```

### Commands

```bash
# Set a baseline in S3
pnpm --filter @exprealty/load-test perf:s3:set-baseline -- --env dev --scenario baseline

# Upload a run summary
pnpm --filter @exprealty/load-test perf:s3:upload -- --env dev --scenario baseline --runid <id>

# Fetch baseline from S3 for comparison
pnpm --filter @exprealty/load-test perf:s3:fetch-baseline -- --env dev --scenario baseline --dest /tmp/baseline.json

# Compare using S3 baseline
pnpm perf:compare -- --baseline /tmp/baseline.json --env dev --scenario baseline
```

### Full S3 Workflow

```bash
# 1. Run baseline test in dev
BASE_URL=https://dev.example.com pnpm loadtest:baseline

# 2. Set as S3 baseline
PERF_S3_BUCKET=my-bucket pnpm --filter @exprealty/load-test perf:s3:set-baseline -- --env dev --scenario baseline

# 3. Later, run again and compare against S3 baseline
PERF_S3_BUCKET=my-bucket pnpm --filter @exprealty/load-test perf:s3:fetch-baseline -- --env dev --scenario baseline --dest artifacts/k6/.s3-baseline.json
pnpm perf:compare -- --baseline artifacts/k6/.s3-baseline.json --env dev --scenario baseline
```

---

## Automatic Comparison via run-k6.sh

Set `PERF_COMPARE=true` to automatically run regression comparison after each k6 run:

```bash
PERF_COMPARE=true BASE_URL=http://localhost:3000 pnpm loadtest:baseline
```

This produces `regression.md` and `regression.json` alongside the other artifacts. The k6 exit code is preserved (comparison failure does not override threshold pass/fail).

You can also set `PERF_ENV` to specify the environment for baseline lookup:

```bash
PERF_COMPARE=true PERF_ENV=dev BASE_URL=https://dev.example.com pnpm loadtest:baseline
```

---

## Jira Attachment Bundle

After a k6 run with comparison, the run directory contains everything needed for a Jira ticket:

```
artifacts/k6/<runid>/
  k6-summary.json        # raw metrics
  k6-summary.md          # run summary (Jira-friendly)
  k6-report.html         # visual report
  k6.log                 # console output
  regression.md          # regression report (Jira-friendly)
  regression.json        # machine-readable diffs
```

Attach `k6-summary.md` + `regression.md` as Jira comments. Attach `k6-report.html` for visual reference.

---

## Script Reference

| Script | Description |
|--------|-------------|
| `pnpm perf:baseline:save -- --env <env> --scenario <name>` | Save latest run as local baseline |
| `pnpm perf:compare -- --env <env> --scenario <name>` | Compare latest run against baseline |
| `pnpm --filter @exprealty/load-test perf:run:save` | Save run to history |
| `pnpm --filter @exprealty/load-test perf:runs` | List saved runs |
| `pnpm --filter @exprealty/load-test perf:s3:set-baseline` | Set S3 baseline |
| `pnpm --filter @exprealty/load-test perf:s3:upload` | Upload summary to S3 |
| `pnpm --filter @exprealty/load-test perf:s3:fetch-baseline` | Fetch S3 baseline |

---

## Files

| File | Description |
|------|-------------|
| `apps/load-test/src/lib/metrics.js` | Curated hotspot Trend metric declarations |
| `apps/load-test/src/lib/http.js` | HTTP wrapper with hotspot recording |
| `apps/load-test/scripts/compare-summaries.mjs` | Regression comparison engine |
| `apps/load-test/scripts/history.mjs` | Local history management |
| `apps/load-test/scripts/s3.mjs` | S3 history management |
