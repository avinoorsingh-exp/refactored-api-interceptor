# Phase 2.2: Projection-Config-Aware Parameterization

Extends the k6 parameter model (Phase 2.1) with **fields projection** and **projection-derived includes**, driven by the actual service projection configs.

---

## Architecture

```
services/agent-service/src/modules/*/config/*-projection.config.ts
  ↓ parsed by
apps/load-test/scripts/generate-projections.mjs
  ↓ produces
apps/load-test/src/generated/projections.json   (checked in)
  ↓ loaded by
apps/load-test/src/lib/params.js                (at k6 init time)
  ↓ drives
randomized includes, fields, paging, search, filters
```

---

## Quick Start

```bash
# 1. Generate projections from service configs
pnpm projections:generate

# 2. Copy and customize env file
cp .env.loadtest.example .env.loadtest.local

# 3. Source env vars and run
set -a; source ./.env.loadtest.local; set +a
pnpm loadtest:baseline
```

---

## Env File Layout

| File | Purpose | Git |
|------|---------|-----|
| `.env.loadtest.example` | Safe template with all vars documented | Committed |
| `.env.loadtest.local` | Local overrides with real values | Gitignored |

Source before any `pnpm loadtest:*` command:

```bash
set -a; source ./.env.loadtest.local; set +a
```

---

## Projection Generator

Scans all `*-projection.config.ts` files and extracts:

| Field | Source |
|-------|--------|
| `required` | Fields always included (PKs, sort keys) |
| `allowed` | All scalar fields available for `?fields=` |
| `default` | Fields returned when no `?fields=` specified |
| `relations` | Available `?include=` keys |

Relation fields and their `property` values are filtered out of the `allowed`/`default` arrays, so only scalar fields remain.

```bash
# Generate/refresh projections
pnpm projections:generate

# Output: apps/load-test/src/generated/projections.json
```

### Output Format

```json
{
  "agents": {
    "required": ["id", "agentId"],
    "allowed": ["id", "agentId", "title", "firstName", ...],
    "default": ["id", "agentId", "title", "firstName", ...],
    "relations": ["agentOffice", "office", "mls", "address", ...]
  },
  "agent-companies": {
    "required": ["id", "name"],
    "allowed": ["id", "legacyId", "name", "email", ...],
    "default": ["id", "legacyId", "name", "email", ...],
    "relations": ["agentAssociations"]
  }
}
```

---

## Fields Projection

### Modes

| Mode | Behavior |
|------|----------|
| `default` | Omit `?fields=` — API returns its default field set |
| `custom` | Send `?fields=csv` with a bounded random subset |
| `mix` | Weighted random: `default` 70% / `custom` 30% |

### Environment Variables

| Var | Default | Description |
|-----|---------|-------------|
| `FIELDS_MODE` | `default` | `default\|custom\|mix` |
| `FIELDS_WEIGHTS` | `default:70,custom:30` | Weights for `mix` mode |
| `FIELDS_COUNT_SET` | `8,12,18` | Target field counts for `custom` mode |

### Safety Guarantees

- **Required fields always included**: custom selections always start with `required` fields from projection config
- **Bounded count**: field count is picked from `FIELDS_COUNT_SET`, never unbounded
- **Scalar only**: relation names are filtered out of the allowed list

### Per-Scenario Behavior

| Scenario | Fields Behavior |
|----------|----------------|
| Smoke | Deterministic: first N fields from allowed list |
| Baseline | Weighted random: mode + count from distributions |
| Stress | Max count from `FIELDS_COUNT_SET` |

---

## Includes (Projection-Derived)

When `projections.json` is available, includes are derived from the `relations` array instead of the hardcoded `INCLUDES_MAP`.

### Levels

| Level | Selection |
|-------|-----------|
| `none` | No includes |
| `light` | 1–2 random relations (bounded by `INCLUDES_LIGHT_MAX=2`) |
| `heavy` | Up to 5 random relations (bounded by `INCLUDES_HEAVY_MAX=5`) |

### Fallback

If `projections.json` is missing, the hardcoded `INCLUDES_MAP_FALLBACK` is used (backward compatible with Phase 2.1).

---

## Module-Specific Overrides

Any global env var can be overridden per module using the pattern:

```
<MODULE>_<SETTING>=value
```

Module names use uppercase with hyphens replaced by underscores.

### Examples

```bash
# Agents: heavier includes, custom fields
AGENTS_INCLUDES=mix
AGENTS_INCLUDES_WEIGHTS=none:50,light:30,heavy:20
AGENTS_FIELDS_MODE=mix
AGENTS_FIELDS_WEIGHTS=default:60,custom:40
AGENTS_FIELDS_COUNT_SET=5,10,15,20

# Agent-companies: keep it simple
AGENT_COMPANIES_INCLUDES=none
AGENT_COMPANIES_FIELDS_MODE=default

# Companies: always custom fields
COMPANIES_FIELDS_MODE=custom
COMPANIES_FIELDS_COUNT_SET=3,5,8
```

---

## Tag Cardinality

All tags remain bounded:

| Tag | Values | Cardinality |
|-----|--------|-------------|
| `pageSize` | 10, 25, 50, 100 | 4 |
| `searchMode` | none, prefix, contains, exact | 4 |
| `includesLevel` | none, light, heavy | 3 |
| `includeCount` | 0, 1, 2, 3, 5+ | 5 |
| `hasFilters` | yes, no | 2 |
| `fieldsMode` | default, custom | 2 |
| `fieldsCount` | 0, 5, 10, 15, 20+ | 5 |

No raw search terms, field names, or include keys appear in tags.

---

## Backward Compatibility

| Condition | Behavior |
|-----------|----------|
| `projections.json` missing | Falls back to hardcoded `INCLUDES_MAP_FALLBACK`; no `fields=` sent |
| `FIELDS_MODE` not set | Defaults to `default` (no `fields=` param) |
| No env vars set | All safe defaults; identical behavior to Phase 2.1 |
| Module override not set | Falls through to global setting |

---

## Files

| File | Description |
|------|-------------|
| `apps/load-test/scripts/generate-projections.mjs` | Projection config parser + JSON generator |
| `apps/load-test/src/generated/projections.json` | Generated projection data (checked in) |
| `apps/load-test/src/lib/params.js` | Extended parameter model with fields + projection includes |
| `.env.loadtest.example` | Env var template (committed) |
| `.env.loadtest.local` | Local env overrides (gitignored) |

---

## Script Reference

| Script | Description |
|--------|-------------|
| `pnpm projections:generate` | Regenerate projections.json from service configs |
| `set -a; source ./.env.loadtest.local; set +a` | Source env vars before load tests |
| `pnpm loadtest:baseline` | Run baseline with current env vars |
