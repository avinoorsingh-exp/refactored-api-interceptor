# Request flow — `@exprealty/api-interceptor`

Paths below are under **`packages/api-interceptor/src/`**.

## Registration

| File | Role |
|------|------|
| `api-interceptor.module.ts` | **`ApiInterceptorModule.forRoot`**: provides `APP_INTERCEPTOR` → **`ApiInterceptor`**, runtime options, **`API_INTERCEPTOR_ON_EXCHANGE`**, **`API_INTERCEPTOR_ASYNC_CONTEXT`**, **`ApiRequestContextService`**. |
| `options/api-interceptor-for-root.options.ts` | **`ApiInterceptorForRootOptions`**: `asyncContext`, `onApiExchange`, payload capture flags. |
| `tokens/api-interceptor-module-options.token.ts` | **`API_INTERCEPTOR_MODULE_OPTIONS`**: clamped byte limits and capture toggles for the interceptor. |
| `tokens/api-interceptor-on-exchange.token.ts` | **`API_INTERCEPTOR_ON_EXCHANGE`**: host callback token. |

## Runtime

| File | Role |
|------|------|
| `interceptors/api-interceptor.interceptor.ts` | **`intercept`**: may emit **skipped** (localhost / excluded origins); otherwise wraps **`next.handle()`**, captures request/response payloads, builds **`ApiExchangeEvent`**, calls **`onApiExchange`**. |
| `services/api-request-context.service.ts` | Reads/writes optional fields on the async store (actor, start time, etc.). |
| `interfaces/async-context.port.ts` | **`IApiInterceptorAsyncContext`**, **`ApiInterceptorRequestStore`**, **`API_INTERCEPTOR_ASYNC_CONTEXT`**. |
| `domain/api-exchange.event.ts` | **`ApiExchangeEvent`**, snapshots, **`ApiExchangeSummary`**. |
| `domain/api-interceptor.types.ts` | **`HttpMethod`**, **`ApiActorType`**, **`ApiErrorClassification`**. |
| `utils/build-api-exchange-summary.util.ts` | Merges HTTP facts + store into **`ApiExchangeSummary`**. |
| `utils/capture-unknown-payload.util.ts` | Structured capture for arbitrary body/error values. |

## Typical sequence

1. Your middleware establishes async context and fills **`ApiInterceptorRequestStore`** (at minimum **`correlationId`** and **`timestamp`**).
2. **`ApiInterceptor`** runs for each HTTP route handler.
3. On success or error, **`onApiExchange`** runs with the full event (or a **skipped** event when the interceptor bypasses full tracking).

See also [api-interceptor.md](./api-interceptor.md).
