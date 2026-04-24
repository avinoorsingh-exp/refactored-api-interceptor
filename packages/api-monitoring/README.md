# `@exprealty/api-monitoring`

**Package version (this line):** `0.2.0` — built for **NestJS 11** and **TypeORM 0.3** (`@nestjs/typeorm` 11). Bump `version` in `package.json` before each CodeArtifact publish.

NestJS module for HTTP API monitoring: request logging, actor attribution, metrics, and read-only admin endpoints. This package is **self-contained** (no other `@exprealty/*` dependencies) so it can be published to **npm / AWS CodeArtifact** and used from any application that already uses **PostgreSQL** and **TypeORM`.

Use this document to **install the package**, **point it at your app’s existing database**, **register the bundled entities**, and **wire your HTTP API** so traffic is recorded.

> **Note:** The **consuming app** can use **npm**, **yarn**, or **pnpm**; commands below list **npm** first, then **pnpm** where both apply. Monorepo-only steps use **pnpm** and paths relative to the **agent-service** repo root.

---

## Prerequisites

- **Node.js** 20+
- **NestJS** **11** (`@nestjs/common` / `@nestjs/core` `^11.0.1` — align consuming apps with this package’s `dependencies`)
- **TypeORM** 0.3+ with **PostgreSQL**
- Tables live in schema **`core`** (default entity metadata). You must create those tables in **your** database (see [Database setup](#2-database-setup-schema-and-migrations)).

**Check versions (run in any terminal):**

```bash
node -v
npm -v
```

**Optional — PostgreSQL client to run SQL or check connectivity:**

```bash
psql --version
```

---

## 1. Install the package

### A. From your private registry (e.g. CodeArtifact) — in the *consumer* app

**1) Authenticate to your registry** (one-time; example is illustrative — follow your org’s docs).

```bash
# Example: AWS CodeArtifact (replace account, domain, and region)
aws codeartifact login --tool npm --domain your-domain --domain-owner 123456789012 --repository npm-packages --region us-east-1
```

**2) Point the `@exprealty` scope to your registry** in the app’s project root, file `.npmrc` (or user-level `~/.npmrc`):

```text
@exprealty:registry=https://<your-codeartifact-or-registry-url>/
# often required: //<host>/:_authToken=${NPM_TOKEN}
```

**3) Add the dependency and install:**

```bash
# npm
npm install @exprealty/api-monitoring

# pnpm
pnpm add @exprealty/api-monitoring

# yarn
yarn add @exprealty/api-monitoring
```

**4) Verify it is listed:**

```bash
# npm
npm ls @exprealty/api-monitoring
```

### B. From this monorepo (workspace)

**1) Add the dependency to your service or app `package.json`:**

```json
{
  "dependencies": {
    "@exprealty/api-monitoring": "workspace:*"
  }
}
```

**2) From the monorepo root (`agent-service/`):**

```bash
pnpm install
```

**Runtime note:** the published package declares only public npm `dependencies` (`@nestjs/*`, `typeorm`, `rxjs`, etc.) — there are **no** `@exprealty/*` *library* dependencies in the installable package.

---

## 2. Database setup (schema and migrations)

The module expects three tables:

| Entity | Table |
|--------|--------|
| `ApiActorEntity` | `core.api_actor` |
| `ApiRequestLogEntity` | `core.api_request_log` |
| `ApiRouteStatsEntity` | `core.api_route_stats` |

**You must apply the same schema to the database your app uses.** This package does **not** run migrations; it only ships **entity** classes.

### If you have this `agent-service` monorepo — run platform migrations

From the **monorepo root** (`agent-service/`), with DB URL/credentials in env or `.env` as your project expects:

```bash
# Run all pending @exprealty/database migrations (includes API monitoring tables when present)
pnpm run migration:run
```

**Local dev DB (script uses port 5433 in the database package; adjust to your setup):**

```bash
pnpm run migration:run:local
```

**Show migration status (if your package exposes it):**

```bash
pnpm --filter @exprealty/database migration:show
```

### If the consumer is an external app (no monorepo)

- Export SQL from your migration tool, **or** copy the relevant statements from the monorepo migrations under `packages/database/src/migrations/` (files related to `api_monitoring`, `api_request_log`, `api_actor`, `api_route_stats`), then apply with **your** process, for example:

```bash
# After writing schema to a file schema-api-monitoring.sql
psql "postgresql://USER:PASS@HOST:5432/DBNAME" -f schema-api-monitoring.sql
```

**Create `core` schema if it does not exist (PostgreSQL):**

```sql
-- Run in psql or your SQL client
CREATE SCHEMA IF NOT EXISTS core;
```

**Per-application DBs:** each app sets `DATABASE_URL` or `DB_HOST` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` (whatever your Nest config uses). No extra step for the package.

---

## 3. Connect TypeORM to your application database

**1) Set database env vars** for the consumer app (example — names are typical, yours may differ):

```bash
# examples — use your real host and credentials
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=myapp
set DB_USERNAME=postgres
set DB_PASSWORD=secret
# Linux/macOS:
# export DB_HOST=localhost
```

**2) Register entities in `TypeOrmModule` in code** (as in the snippet below). This is not a shell command; after editing, build/run:

```bash
# consumer app
npm run build
npm run start:prod
# dev:
npm run start:dev
```

**Code — Option A, explicit list:**

```typescript
import { TypeOrmModule } from '@nestjs/typeorm'
import { API_MONITORING_TYPEORM_ENTITIES } from '@exprealty/api-monitoring'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      // ... your connection options ...
      database: process.env.DB_NAME,
      entities: [
        // ... your other app entities ...
        ...API_MONITORING_TYPEORM_ENTITIES,
      ],
      autoLoadEntities: true, // optional
      synchronize: false,
    }),
  ],
})
export class AppModule {}
```

**Option B —** rely on `autoLoadEntities: true` and `TypeOrmModule.forFeature` from `ApiMonitoringModule.forRoot` (see next section).

**Named connection** — if you use `name: 'metrics'` in `forRoot`, set `dataSourceName: 'metrics'` in `ApiMonitoringModule.forRoot({ ... })`.

---

## 4. Configure the module: `ApiMonitoringModule.forRoot`

| Option | Required | Description |
|--------|----------|-------------|
| `logger` | Yes | Class token implementing `IApiMonitoringLogger`. |
| `asyncContext` | Yes | Class implementing `IApiMonitoringAsyncContext`. |
| `entities` | No | Omit to use defaults from this package. |
| `dataSourceName` | No | Only for a **named** TypeORM connection. |

**After code changes, same as any Nest app:**

```bash
npm run build
npm run start:dev
```

**Minimal example:**

```typescript
import {
  ApiMonitoringModule,
  API_MONITORING_LOGGER_TOKEN,
} from '@exprealty/api-monitoring'

@Module({
  imports: [
    ApiMonitoringModule.forRoot({
      logger: MyLoggerService,
      asyncContext: MyApiMonitoringAsyncContextAdapter,
    }),
  ],
})
export class AppModule {}
```

---

## 5. HTTP pipeline: correlation → actor → interceptors

**1) Order middleware in `AppModule.configure()`** (TypeScript; then `npm run start:dev`).

**2) If the middleware is registered in `AppModule`**, add the logger bridge:

```bash
# no extra shell command; ensure providers in AppModule include:
# { provide: API_MONITORING_LOGGER_TOKEN, useExisting: MyLoggerService }
```

**3) Start the app and send a test request:**

```bash
# replace port with your app
curl -i http://localhost:3000/health
```

---

## 6. Optional: environment-based tuning

Set in the process environment (CI, Docker, or `.env` loaded by your app, **not** by this package automatically):

**Linux / macOS:**

```bash
export API_MONITORING_ENABLED=true
export API_MONITORING_SAMPLE_RATE=1.0
export API_MONITORING_EXCLUDE_ORIGINS=internal.mydomain.com
```

**Windows PowerShell:**

```powershell
$env:API_MONITORING_ENABLED = "true"
$env:API_MONITORING_SAMPLE_RATE = "1.0"
$env:API_MONITORING_EXCLUDE_ORIGINS = "internal.mydomain.com"
```

**Windows CMD:**

```cmd
set API_MONITORING_ENABLED=true
set API_MONITORING_SAMPLE_RATE=1.0
set API_MONITORING_EXCLUDE_ORIGINS=internal.mydomain.com
```

| Variable | Purpose |
|----------|---------|
| `API_MONITORING_ENABLED` | Master switch |
| `API_MONITORING_SAMPLE_RATE` | `0.0`–`1.0` sample rate |
| `API_MONITORING_EXCLUDE_ORIGINS` | Comma-separated origin substrings to exclude |

---

## 7. Exposed HTTP API (read-only / admin)

**Start your Nest app, then (replace host/port and add auth if required):**

```bash
# summary (adjust query params to your implementation)
curl -s "http://localhost:3000/v1/api-monitoring/summary"

# time series (example query string — use ISO dates your DTOs expect)
curl -s "http://localhost:3000/v1/api-monitoring/metrics/time-series?startTime=2024-01-01T00:00:00.000Z&endTime=2024-01-31T23:59:59.999Z"

# routes breakdown
curl -s "http://localhost:3000/v1/api-monitoring/metrics/routes?startTime=2024-01-01T00:00:00.000Z&endTime=2024-01-31T23:59:59.999Z"
```

**Protect these routes** in production (guards, reverse proxy, private network). They are not authenticated by the package.

---

## 8. Build, test, and local pack

**Inside `packages/api-monitoring/`:**

```bash
cd packages/api-monitoring
pnpm run build
pnpm test
```

**Build + all tests and dist checks from monorepo root (`agent-service/`):**

```bash
cd /path/to/agent-service
pnpm run test:full
```

**Typecheck only:**

```bash
cd packages/api-monitoring
pnpm run check
```

**Dry-run what will be published (no upload):**

```bash
cd packages/api-monitoring
npm run pack:check
```

`package.json` only ships the `files` list (`dist/`) plus default metadata (README, `package.json`, etc.); source stays out of the tarball.

---

## 9. Publish to AWS CodeArtifact

`@exprealty/api-monitoring` is configured to publish to your **eXp CodeArtifact** npm repository via `publishConfig` in this package. The monorepo `.npmrc` also maps `@exprealty` to that registry.

### 9.1 Prereqs

- **AWS credentials** (SSO, env vars, or instance role) with permission: `codeartifact:PublishPackageVersion`, `GetAuthorizationToken`, and read on the `npm` repo.
- **Version bump** before each publish: edit `version` in `packages/api-monitoring/package.json` (or use `npm version` / Changesets) so the registry accepts a new tarball.

### 9.2 Log in to CodeArtifact (npm) — one-time per token lifetime

**Replace** account, `domain`, `domain-owner`, `repository`, and `region` if your org’s names differ (this repo’s registry URL is in the root `.npmrc` and in `publishConfig`).

```bash
aws codeartifact login \
  --tool npm \
  --domain your-domain \
  --domain-owner 123456789012 \
  --repository npm-packages \
  --region us-east-1
```

This writes the auth line into your user or project `npm` config. Ensure `@exprealty:registry=…` points at the same **CodeArtifact** `npm` endpoint as in `publishConfig`.

### 9.3 Build and publish from the monorepo (recommended)

From the **`agent-service/`** repo root:

```bash
# optional: run tests
pnpm run test:full

# build + publish this package (uses prepublishOnly → build)
pnpm run publish:api-monitoring
```

Or from **`packages/api-monitoring/`** only:

```bash
cd packages/api-monitoring
npm run build
npm publish
# or: pnpm publish
```

`prepublishOnly` runs `npm run build` so `dist/` is fresh. Do **not** commit secrets; CI should use **OIDC** or **aws codeartifact get-authorization-token** + `npm config set` in the pipeline.

### 9.4 Consuming the published package in another app

**`.npmrc`** in the app (or CI):

```text
@exprealty:registry=https://exprealty-125434132943.d.codeartifact.us-east-1.amazonaws.com/npm/npm-packages/
```

Then:

```bash
aws codeartifact login --tool npm --domain <domain> --domain-owner <account> --repository npm-packages --region <region>
npm install @exprealty/api-monitoring
```

(Use the same login pattern your team already uses for other `@exprealty` packages.)

---

## 10. Architecture summary

| Piece | Role |
|-------|------|
| `ApiMonitoringInterceptor` | Global interceptor: latency, status, metadata → `api_request_log` |
| `ApiActorMiddleware` | Actors → `api_actor` |
| `ApiMonitoringService` | Logging, classification, sampling |
| `ApiMetricsService` | Aggregations, top callers, trends, … |
| `ApiMonitoringController` | Read-only / admin HTTP API |

---

## 11. Security notes

- Error sanitization; stack traces for server errors only.  
- **Do not** expose `/v1/api-monitoring` without auth.  
- Request/response bodies are not logged by default.  

For details, see `src/` and `tests/`.
