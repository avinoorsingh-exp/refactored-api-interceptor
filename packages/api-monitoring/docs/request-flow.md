# Request flow — from first code to saved log

This page shows **where one HTTP request goes** in `@exprealty/api-monitoring`, in order. Wording is kept simple; file names are **paths under `src/`** (add `packages/api-monitoring/` in the repo).

> **Your app runs first.** Anything you register *before* this package (body parser, CORS, **your** correlation-id middleware) runs before the steps below. This diagram starts at the usual “monitoring” entry points.

---

## Diagram (request in → row saved)

```mermaid
flowchart TD
  subgraph Host["Your Nest app (not in this package)"]
    H0["Your middleware: fill async store<br/>correlationId, timestamp, …"]
  end

  subgraph MW["Actor step — if you registered ApiActorMiddleware"]
    M1["api-actor.middleware.ts — <b>use()</b><br/>Who is calling? Maybe skip origin."]
    M2["api-actor.service.ts — <b>getOrCreateActor()</b><br/>Find or create api_actor row."]
    M3["api-request-context.service.ts — <b>updateActor()</b><br/>Store actor id/type on this request."]
    M4["api-monitoring-user.service.ts — <b>upsertForUserActor()</b><br/>USER only: api_monitoring_user."]
    M5["api-request-context.service.ts — <b>updateMonitoringUser()</b><br/>Store profile id on this request."]
    M6["<b>next()</b> — Nest continues."]
  end

  subgraph Nest["Nest HTTP pipeline"]
    N1["Guards / pipes — yours"]
    N2["Your controller — business logic"]
  end

  subgraph Int["Global interceptor — APP_INTERCEPTOR"]
    I1["api-monitoring.interceptor.ts — <b>intercept()</b><br/>Read route, headers, optional body."]
    I2["api-request-context.service.ts — <b>setStartTime()</b>"]
    I3["<b>next.handle()</b> — runs your controller"]
    I4["<b>tap</b> / <b>catchError</b> — after response"]
    I5["api-monitoring.service.ts — <b>buildRequestMetadata()</b>"]
    I6["api-monitoring.service.ts — <b>logRequest()</b>"]
    I7["Repository <b>save()</b> — api_request_log row"]
  end

  H0 --> M1
  M1 --> M2 --> M3
  M3 -->|USER with external id| M4 --> M5 --> M6
  M3 -->|anonymous / API key / no profile step| M6
  M6 --> N1 --> I1
  I1 --> I2 --> I3 --> N2
  N2 --> I4 --> I5 --> I6 --> I7
```

**Middleware paths:** after **`updateActor`**, either the request goes **straight to `next()`**, or (for a **USER** with an **external id**) it also runs **`upsertForUserActor`** → **`updateMonitoringUser`** → **`next()`**.

**Note on the interceptor:** `intercept()` runs **around** your controller: it executes **before** `next.handle()`, then **`tap` / `catchError`** run **after** the controller returns (or throws).

---

## Step-by-step (file → function → plain English)

| Order | File | Function (main) | What it does (easy) |
|------:|------|-----------------|---------------------|
| 0 | *(your code)* | *(your ALS / middleware)* | Puts **correlation id** and **timestamp** on the request store so every later step can read the same values. |
| 1 | `middleware/api-actor.middleware.ts` | `use()` | Entry for actor handling: can **skip** some requests (e.g. certain origins), then figures out **user / API key / anonymous**, talks to the DB, and writes **actor** (and sometimes **monitoring user**) into **context**. |
| 2 | `services/api-actor.service.ts` | `getOrCreateActor()` | **Load or insert** the caller in **`api_actor`** so every log line can point at a stable **actor id**. |
| 3 | `services/api-request-context.service.ts` | `updateActor()` | Saves **actor id** and **actor type** on the **async request store** (same request only). |
| 4 | `services/api-monitoring-user.service.ts` | `upsertForUserActor()` | **Only for human USER actors:** upsert **`api_monitoring_user`** (email, external id, last app, …). |
| 5 | `services/api-request-context.service.ts` | `updateMonitoringUser()` | Saves **monitoring user id** on the store when a profile row exists. |
| — | *(Nest)* | `next()` | Hands off to the rest of the pipeline (guards, then interceptor + controller). |
| 6 | `interceptors/api-monitoring.interceptor.ts` | `intercept()` | **Global hook:** can skip some requests; reads **path, method, IP, headers** (`x-source-app`, `x-retry-count`), optional **body snapshot**; wraps **`next.handle()`**. |
| 7 | `services/api-request-context.service.ts` | `setStartTime()` | Records when work started so **latency** can be computed later. |
| 8 | *(your code)* | Controller handler | Your normal **route code**; response status and body are observed by the interceptor after this finishes. |
| 9 | `interceptors/api-monitoring.interceptor.ts` | `tap` / `catchError` | **After** the handler: compute **latency**, read **status**, build **metadata** (success or error). |
| 10 | `services/api-monitoring.service.ts` | `buildRequestMetadata()` | Combines **route + HTTP result + headers/body fields** with **whatever is on context** (actor, correlation, monitoring user). |
| 11 | `services/api-monitoring.service.ts` | `logRequest()` | If monitoring is **on**, there is an **actor id**, and **sampling** allows it → **insert** one log row. |
| 12 | TypeORM + `entities/api-request-log.entity.ts` | `save()` via repo | **Writes** the row to **`api_request_log`** in PostgreSQL. |

---

## If you skip the actor middleware

- Steps **1–5** do not run from this package.
- **`logRequest()`** will usually **not save** anything, because **`actorId`** will be missing (see `api-monitoring.service.ts`).
- The **interceptor** (steps **6–12**) can still run; only persistence depends on context.

---

## After save: dashboards (different request)

Reading metrics is a **new HTTP request** to **`api-monitoring.controller.ts`**, not part of the same pipeline as above.

| File | Function (idea) | What it does (easy) |
|------|-----------------|---------------------|
| `api-monitoring.controller.ts` | `@Get(...)` handlers | Admin-style URLs; each calls the metrics service. |
| `services/api-metrics.service.ts` | Various query methods | **SELECT** from **`api_route_stats`** (fast) and sometimes **`api_request_log`** (detail / fallback). |
| `services/api-metrics.service.ts` | `aggregateAllRouteStats()` etc. | **Builds or refreshes** rollup rows in **`api_route_stats`** (often via **`GET .../aggregate`**), not on every normal API call. |

---

## See also

- [architecture.md](./architecture.md) — how modules and services connect.
- [api-monitoring.md](./api-monitoring.md) — database tables and headers.
