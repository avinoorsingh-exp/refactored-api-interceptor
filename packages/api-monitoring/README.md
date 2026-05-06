# `@exprealty/api-monitoring`

**Package version (this line):** `0.2.2` — built for **NestJS 11** and **TypeORM 0.3** (`@nestjs/typeorm` 11). Bump `version` in `package.json` when you cut a release.

**Schema / ERD:** [docs/api-monitoring.md](./docs/api-monitoring.md) (Mermaid ERD and column reference).

NestJS module for HTTP API monitoring: request logging, actor attribution, optional **end-user profile** rows (`api_monitoring_user`), metrics, and read-only admin endpoints. This package is **self-contained** (no other `@exprealty/*` dependencies) so it can be published to an **npm-compatible registry** or consumed via **workspace** from any application that already uses **PostgreSQL** and **TypeORM**.

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

### A. From a private or public npm registry — in the *consumer* app

Configure scope and auth the way your organization does (`.npmrc`, CI tokens, and so on), then:

```bash
# npm
npm install @exprealty/api-monitoring

# pnpm
pnpm add @exprealty/api-monitoring

# yarn
yarn add @exprealty/api-monitoring
```

Verify:

```bash
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

The module expects **four** tables:

| Entity | Table |
|--------|--------|
| `ApiActorEntity` | `core.api_actor` |
| `ApiMonitoringUserEntity` | `core.api_monitoring_user` |
| `ApiRequestLogEntity` | `core.api_request_log` |
| `ApiRouteStatsEntity` | `core.api_route_stats` |

For **`ApiMonitoringUserEntity`**: stores **`external_id`** (stable user key from your IdP), optional **`email`**, optional **`user_uuid`** when the key is UUID-shaped, optional **`last_source_application`** (last seen **`x-source-app`** on upsert), and **`actor_id`** pointing at the USER’s `api_actor` row. **`ApiActorMiddleware`** upserts this row for `ApiActorType.USER` and sets **`monitoring_user_id`** on each request log via async context. **`ApiMonitoringInterceptor`** also stores **`source_application`** on each **`api_request_log`** row from the same header. See [docs/api-monitoring.md](./docs/api-monitoring.md).

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

- Export SQL from your migration tool, **or** copy the relevant statements from the monorepo migrations under `packages/database/src/migrations/` (files related to `api_monitoring_user`, `api_request_log`, `api_actor`, `api_route_stats`), then apply with **your** process, for example:

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
| `entities` | No | Omit to use defaults from this package (includes `ApiMonitoringUserEntity` and the other three monitoring entities). If you pass a custom bundle, you must supply **all four** class tokens. |
| `dataSourceName` | No | Only for a **named** TypeORM connection. |
| `captureRequestBody` | No | Default `false`. If `true`, stores a UTF-8 snapshot of parsed `req.body` in `core.api_request_log.request_body_snapshot` (requires a DB migration that adds this column). **PII/secrets risk** — enable only with policy/redaction. |
| `requestBodyMaxBytes` | No | Max stored bytes for the snapshot (default `16384`, clamped between `256` and `1048576`). Longer payloads are cut with a `…[truncated]` suffix. |

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

**Example with request body capture** (substitute your logger and async-context classes; below matches the `agent-service` app pattern):

```typescript
ApiMonitoringModule.forRoot({
  logger: LoggerService,
  asyncContext: ApiMonitoringCacheAsyncContextAdapter,
  // Request body snapshots (opt-in; run DB migration for `request_body_snapshot` first)
  captureRequestBody: true,
  requestBodyMaxBytes: 16_384, // optional; default 16384, clamped 256–1_048_576
}),
```

**Notes:**

- Apply the migration that adds `core.api_request_log.request_body_snapshot` **before** turning `captureRequestBody` on.
- Only **parsed** `req.body` is captured (JSON, urlencoded, etc., as your Nest/Express pipeline configures).
- `logRequest` **still skips** persisting a row when **`actorId`** is missing in context (see [Where `actorId` is set](#where-actorid-is-set-not-in-forroot)).
- Treat stored bodies as **sensitive** (PII/secrets); use policy, redaction, and retention as required.

### Source application header (`x-source-app`)

When a **calling product** (IMS, TRX, an internal portal, etc.) invokes your API—directly or via a gateway—send a short, stable label on **`x-source-app`**. The package:

- Persists **`source_application`** on each **`api_request_log`** row (with **`monitoring_user_id`** / **`actor_id`** when auth + middleware ran).
- Passes the same value into **`ApiMonitoringUserService.upsertForUserActor`**, which updates **`last_source_application`** on **`api_monitoring_user`** (optional convenience; **per-request** truth is always the log row).

Apply the database migration that adds **`source_application`** and **`last_source_application`** (see `packages/database/src/migrations/*AddSourceApplicationToApiMonitoring*.ts` in the monorepo).

**Dummy request (HTTP)** — replace host, path, and auth; correlation header name must match how your app sets async context:

```http
POST /v1/example/resource HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
x-source-app: IMS
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "intent": "syncListing",
  "listingId": "MLS-123456",
  "metadata": { "region": "US-WEST" }
}
```

**Minimal JSON body only** (headers as above):

```json
{
  "intent": "syncListing",
  "listingId": "MLS-123456",
  "metadata": { "region": "US-WEST" }
}
```

Exported helpers: **`API_MONITORING_SOURCE_APP_HEADER`** (`x-source-app`) and **`parseSourceApplicationHeader`**.

### Where `actorId` is set (not in `forRoot`)

You **do not** pass `actorId` into `ApiMonitoringModule.forRoot`.

1. **`asyncContext`** — Your adapter (e.g. one backed by `AsyncLocalStorage` or `@exprealty/cache`’s `AsyncContextStorage`) must expose the **same** per-request store the app uses for correlation and monitoring metadata.
2. **`ApiActorMiddleware`** — Register it in `AppModule.configure()` **after** middleware that creates that store (e.g. correlation ID). It resolves the caller (authenticated user, API key, etc.) or an anonymous actor, then calls `ApiRequestContextService.updateActor(actorId, actorType)`, which writes into that async store.
3. **`ApiMonitoringService.logRequest`** — Reads `actorId` (and related fields) from context when the interceptor runs. If `actorId` is still missing, the request log row is **not** saved.

4. **`monitoringUserId`** — For `ApiActorType.USER`, the middleware also calls `ApiMonitoringUserService.upsertForUserActor` and `ApiRequestContextService.updateMonitoringUser` so `api_request_log.monitoring_user_id` is filled when a profile row exists. You do not set this in `forRoot`.

To change *how* an actor is derived from `req` (headers, `req.user`, JWT, etc.), adjust **`ApiActorMiddleware`** / your auth order—not `forRoot` options.

---

## 5. HTTP pipeline: correlation → actor → interceptors

**1) Order middleware in `AppModule.configure()`** (TypeScript; then `npm run start:dev`). Correlation first, then **`ApiActorMiddleware`**, so the async store and `actorId` exist before the global interceptor records the request.

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
pnpm run clean   # removes dist/ (ignore error if dist did not exist)
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

Publishing (registry URL, auth, and CI) is owned by your **monorepo / platform docs** and `publishConfig` in `package.json`, not duplicated here.

---

## 9. Architecture summary

| Piece | Role |
|-------|------|
| `ApiMonitoringInterceptor` | Global interceptor: latency, status, metadata → `api_request_log`; optional `request_body_snapshot` when `captureRequestBody` is true |
| `ApiActorMiddleware` | Actors → `api_actor`; for **USER**, upserts `api_monitoring_user` and sets context `monitoringUserId` |
| `ApiMonitoringUserService` | Upserts `core.api_monitoring_user` (`external_id`, `email`, `actor_id`, optional `last_source_application` from `x-source-app`) |
| `ApiMonitoringService` | Logging, classification, sampling; persists `monitoring_user_id` and `source_application` on `api_request_log` when present |
| `ApiMetricsService` | Aggregations, top callers, trends, … |
| `ApiMonitoringController` | Read-only / admin HTTP API |

---

## 10. Security notes

- Error sanitization; stack traces for server errors only.  
- **Do not** expose `/v1/api-monitoring` without auth.  
- Request bodies are **not** stored unless you set `captureRequestBody: true` (and run the DB migration for `request_body_snapshot`). Treat captured bodies as **sensitive** (PII/secrets).  
- **`api_monitoring_user`** stores **email** and **external user id** for authenticated USER actors — treat as **PII**; restrict DB access and retention.

For details, see `src/`, `tests/`, and [docs/api-monitoring.md](./docs/api-monitoring.md).

---

## 11. Operational blockers and how to resolve them

### 11.1 Checklist (what can go wrong)

| Topic | Blocker? |
|-------|----------|
| **Database** | Tables in `core` must exist (migrations). |
| **`request_body_snapshot`** | Column only exists after the migration that adds it; enabling `captureRequestBody` before migrating can cause insert errors. |
| **`api_monitoring_user` / `monitoring_user_id`** | Table and `api_request_log.monitoring_user_id` must exist (migration `CreateApiMonitoringUserTable`). Without them, USER upserts / inserts can fail. |
| **`req.body`** | Snapshots use **parsed** body only. Raw streams, wrong middleware order, or skipped parsers mean little or nothing to capture. |
| **Actor ID** | `ApiMonitoringService.logRequest` skips persistence when `actorId` is missing (see service behavior). |
| **PII / compliance** | Storing bodies may violate policy unless redacted or allowed by legal/security. |

### 11.2 Resolutions (what to do)

| Topic | How to resolve |
|-------|----------------|
| **Database / `core` schema** | Run your app’s TypeORM migrations against the same database as `TypeOrmModule.forRoot`. In this monorepo: `pnpm run migration:run` (or `migration:run:local`) from `agent-service/`. Ensure `CREATE SCHEMA IF NOT EXISTS core;` if your process requires it. |
| **`request_body_snapshot` column** | Apply the migration that adds `request_body_snapshot` to `core.api_request_log` **before** setting `captureRequestBody: true` in `ApiMonitoringModule.forRoot`. If inserts fail, run pending migrations or turn off `captureRequestBody` until the column exists. |
| **`api_monitoring_user`** | Run migrations that create `core.api_monitoring_user` and add `monitoring_user_id` to `api_request_log`. The middleware tolerates upsert failures (warns only), but missing columns will break inserts. |
| **Empty or missing `req.body`** | Rely on Nest/Express body parsing so `req.body` is filled before the interceptor runs. Check `Content-Type`, body size limits, and route-specific parsers. Multipart/raw streams are not JSON snapshots unless you parse them into `req.body` yourself. |
| **No rows / missing `actorId`** | Ensure correlation + `ApiActorMiddleware` run in the right order and that your auth/gateway provides headers (or logic) the middleware uses so async context includes `actorId`. If you need logs **without** an actor, that requires a **code/product change** (today the service skips save when `actorId` is absent). |
| **PII / secrets in stored bodies** | Default is `captureRequestBody: false`. If enabled: lower `requestBodyMaxBytes`, redact in your own middleware before monitoring, define retention and access controls, and follow legal/security sign-off. |
| **Where to set capture options** | In the consuming app: `ApiMonitoringModule.forRoot({ captureRequestBody, requestBodyMaxBytes, ... })` (same object as `logger` / `asyncContext`). There are no env vars in the package; map env → options in your `AppModule` if needed. |
