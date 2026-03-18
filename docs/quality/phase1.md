# Phase 1: Test, Coverage & Load-Test Standardization

Standardized scripts, coverage enforcement, and deterministic artifact outputs for the monorepo.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.19.0 | Pinned in `.nvmrc` — use `nvm use` |
| pnpm | >= 9.0.0 | `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| Docker & Docker Compose | Latest stable | Required for local stack |
| k6 | >= 0.54.0 | Only needed for load tests. Install: `brew install k6` or use the docker-compose.k6.yml |

---

## Starting the Local Stack

```bash
# Start postgres, redis, agent-service, and orchestrator
docker compose up -d

# Or just infrastructure (DB + Redis) for running the service natively
docker compose up -d postgres redis

# Service is available at http://localhost:3000
# Health check: GET http://localhost:3000/v1/agent/health
```

### Environment files

- `.env` — root-level shared env (gitignored)
- `services/agent-service/.env.agentservice` — service-specific env
- See `.env.agentservice.example` for required variables

---

## Running Tests

### Unit Tests

```bash
# Run all service unit tests
pnpm test

# Explicit alias
pnpm test:unit

# Watch mode
pnpm test:unit:watch

# Single package
pnpm --filter @exprealty/agent-service test
pnpm --filter @exprealty/encryption test

# Single test file pattern
pnpm --filter @exprealty/agent-service test -- --testPathPattern "agent-company.service"
```

### E2E Tests

```bash
# Requires local stack running (docker compose up -d)
pnpm test:e2e
```

---

## Coverage

### Running Coverage Locally

```bash
# Run unit tests with coverage for all services + packages
pnpm coverage
```

Coverage reports are written to each workspace's `coverage/` directory:
- `services/agent-service/coverage/`
- `packages/encryption/coverage/`

Each directory contains:
- `lcov.info` — LCOV format (for IDE integrations and CI tools)
- `coverage-summary.json` — JSON summary
- `index.html` — HTML report (open in browser)
- `cobertura-coverage.xml` — Cobertura format (for CI dashboards)

### Coverage Thresholds

Thresholds are enforced by Jest and will **fail the command** if not met.

**Default thresholds** (from `jest.preset.unit.cjs`):

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Statements | 80% |
| Functions | 75% |
| Branches | 70% |

Packages can override thresholds in their local `jest.config.cjs`:

```javascript
// Example: packages/encryption/jest.config.cjs
module.exports = {
  ...unitPreset,
  coverageThreshold: {
    global: { lines: 90, functions: 90, branches: 85, statements: 90 },
  },
};
```

### CI Coverage Artifacts

```bash
# Run coverage AND export to deterministic artifact directory
pnpm coverage:ci
```

This produces:

```
artifacts/
  coverage/
    agent-service/      # Full coverage report for agent-service
      lcov.info
      coverage-summary.json
      index.html
      ...
    encryption/          # Full coverage report for encryption package
      ...
```

---

## Load Tests (k6)

See [Phase 2: Load Test Harness](./phase2.md) for full details on scenarios, env vars, and artifact generation.

### Quick Start

```bash
# Smoke test (3 VUs, 45s)
pnpm loadtest:smoke

# Baseline (10 VUs, ~2.5 min)
pnpm loadtest:baseline

# Stress (50 VUs, ~5 min)
pnpm loadtest:stress

# Against a custom URL
BASE_URL=https://dev.example.com pnpm loadtest:smoke
```

### k6 Artifact Directory

When using `pnpm loadtest:*` or `./scripts/run-k6.sh`, artifacts are written to:

```
artifacts/
  k6/
    <runid>/            # Format: YYYYMMDDTHHMMSS-<git-short-sha>
      k6-summary.json   # End-of-test summary (thresholds, metrics, checks)
      k6-summary.md     # Jira-friendly markdown report
      k6-report.html    # Self-contained HTML report
      k6.log            # Full console output
```

The `runid` includes the git short SHA when available, otherwise just the ISO timestamp.

---

## Available Scenarios

| Scenario | Script | Description |
|----------|--------|-------------|
| agents | `k6:agents` | GET /v1/agents — ramp to 10 VUs |
| agent-companies | `k6:agent-companies` | Agent company endpoints |
| agent-taxes | `k6:agent-taxes` | Agent tax endpoints |
| admin | `k6:admin` | Admin endpoints |
| companies | `k6:companies` | Company endpoints |
| countries | `k6:countries` | Country endpoints |
| currencies | `k6:currencies` | Currency endpoints |
| line-of-business | `k6:line-of-business` | LOB endpoints |
| metadata | `k6:metadata` | Metadata endpoints |
| mls | `k6:mls` | MLS endpoints |
| offices | `k6:offices` | Office endpoints |
| pay-plans | `k6:pay-plans` | Pay plan endpoints |
| regions | `k6:regions` | Region endpoints |
| states | `k6:states` | State endpoints |

---

## Script Reference

| Script | Description |
|--------|-------------|
| `pnpm test` | Run all unit tests |
| `pnpm test:unit` | Run all unit tests (explicit) |
| `pnpm test:unit:watch` | Unit tests in watch mode |
| `pnpm test:e2e` | Run E2E tests (requires local stack) |
| `pnpm coverage` | Unit tests with coverage enforcement |
| `pnpm coverage:ci` | Coverage + export to `artifacts/coverage/` |
| `pnpm loadtest:smoke` | k6 smoke test with artifacts |
| `pnpm loadtest:baseline` | k6 baseline test with artifacts |
| `pnpm loadtest:stress` | k6 stress test with artifacts |

---

## Artifact Directory Layout

```
artifacts/                          # gitignored — CI collects from here
  coverage/
    <workspace-name>/               # e.g. agent-service, encryption
      lcov.info
      coverage-summary.json
      index.html
      cobertura-coverage.xml
  k6/
    <runid>/                        # e.g. 20260224T143000-a1b2c3d
      k6-summary.json
      k6-summary.md
      k6-report.html
      k6.log
```

All artifacts are gitignored. CI pipelines (Phase 4) will collect from `artifacts/` for dashboard uploads and Jira attachments.
