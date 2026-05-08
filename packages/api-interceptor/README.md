# `@exprealty/api-interceptor`

NestJS **global HTTP interceptor** that observes each request/response and invokes your **`onApiExchange`** callback with a structured **`ApiExchangeEvent`**. There is **no database**, TypeORM, or persistence in this package—the host decides what to log, forward, or store.

**Version:** see `version` in `package.json`.

**Request flow:** [docs/request-flow.md](./docs/request-flow.md)

---

## Install

```bash
npm install @exprealty/api-interceptor
# or
pnpm add @exprealty/api-interceptor
```

**Workspace (monorepo):**

```json
{
  "dependencies": {
    "@exprealty/api-interceptor": "workspace:*"
  }
}
```

---

## Quick start

### Prerequisites (host application)

To get useful events (correlation id, actor/user, etc.) the **host application** must provide:

1. **Node + NestJS**
   - Node 20+ (recommended)
   - NestJS app using the HTTP platform (Express-compatible request/response objects)

2. **`reflect-metadata` enabled**
   - Ensure your host app imports it once at startup (usually in `main.ts`):

```ts
import 'reflect-metadata';
```

3. **Per-request async context store**
   - You must implement **`IApiInterceptorAsyncContext`** (commonly backed by `AsyncLocalStorage`) and run a store for every incoming request.
   - At minimum, populate `ApiInterceptorRequestStore` with:
     - `correlationId` (string)
     - `timestamp` (number, e.g. `Date.now()`)
   - Optionally include:
     - `actorId`, `actorType`, `monitoringUserId`

4. **A safe `onApiExchange` handler**
   - The callback must **not throw** (the interceptor intentionally swallows callback errors to avoid breaking requests).

### Register the module

Register **`ApiInterceptorModule.forRoot`** with **`asyncContext`** and **`onApiExchange`**.

```typescript
import { Module } from '@nestjs/common';
import {
  ApiInterceptorModule,
  type ApiExchangeEvent,
} from '@exprealty/api-interceptor';

@Module({
  imports: [
    ApiInterceptorModule.forRoot({
      asyncContext: MyAsyncContextAdapter,
      onApiExchange: (event: ApiExchangeEvent) => {
        // persist, log, or forward — must not throw (errors are swallowed)
      },
    }),
  ],
})
export class AppModule {}
```

### Optional capture configuration

- `exchangePayloadMaxBytes` (default `16384`, clamped `256`–`1_048_576`)
- `captureExchangeRequestPayload` (default `true`; set `false` to omit `event.request.body`)
- `captureExchangeResponsePayload` (default `true`; set `false` to omit `event.response.body`)

---

## Headers and helpers

| Constant | Header | Helper |
|----------|--------|--------|
| `API_INTERCEPTOR_SOURCE_APP_HEADER` | `x-source-app` | `parseSourceApplicationHeader` |
| `API_INTERCEPTOR_RETRY_COUNT_HEADER` | `x-retry-count` | `parseRetryCountHeader` |

---

## Environment

| Variable | Purpose |
|----------|---------|
| `API_INTERCEPTOR_EXCLUDE_ORIGINS` | Comma-separated origin hostname substrings; matching **Origin** / **Referer** skips full tracking (still emits a **skipped** phase event). |

The interceptor also skips **localhost** and common **private** client IPs for the full tracking path.

---

## Build and test

From repo root:

```bash
pnpm install
pnpm run build
pnpm run test
```

From `packages/api-interceptor/`:

```bash
pnpm run check
pnpm run lint
pnpm run test:full
```

---

## Public exports

See **`src/index.ts`**: **`ApiInterceptorModule`**, **`ApiInterceptor`**, **`ApiRequestContextService`**, **`API_INTERCEPTOR_*`** tokens, exchange types, and domain enums (`HttpMethod`, `ApiActorType`, `ApiErrorClassification`).
