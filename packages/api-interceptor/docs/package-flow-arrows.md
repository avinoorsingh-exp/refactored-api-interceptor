# File-to-file flow (arrows) — `@exprealty/api-interceptor`

This page shows how the **main source files** in this package **point to each other** (imports/exports) and where they’re **consumed at runtime**.

## Public entry (what consumers import)

```text
Host app
  |
  |  import { ApiInterceptorModule } from '@exprealty/api-interceptor'
  v
src/index.ts
  |
  |  re-exports (public API surface)
  +--> ApiInterceptorModule  (src/api-interceptor.module.ts)
  +--> ApiInterceptor        (src/interceptors/api-interceptor.interceptor.ts)
  +--> ApiRequestContextService (src/services/api-request-context.service.ts)
  +--> Types: ApiExchangeEvent, ApiCapturedPayload, ... (src/domain/api-exchange.event.ts)
  +--> Enums: HttpMethod, ApiActorType, ... (src/domain/api-interceptor.types.ts)
  +--> Header helpers (src/utils/parse-*.util.ts)
```

## Registration wiring (what `forRoot` sets up)

```text
src/api-interceptor.module.ts
  |
  | ApiInterceptorModule.forRoot(options)
  v
DynamicModule providers:
  |
  +--> API_INTERCEPTOR_MODULE_OPTIONS  -> runtime capture flags/limits (value)
  |
  +--> API_INTERCEPTOR_ON_EXCHANGE     -> host callback function (value)
  |
  +--> API_INTERCEPTOR_ASYNC_CONTEXT   -> host async-context adapter class (useClass)
  |
  +--> ApiRequestContextService        -> helper service (class)
  |
  +--> APP_INTERCEPTOR -> ApiInterceptor  (global interceptor for all routes)
```

## Runtime flow (what happens per request)

```text
Incoming HTTP request to host Nest app
  |
  v
src/interceptors/api-interceptor.interceptor.ts  (ApiInterceptor.intercept)
  |
  +--> reads request details (route/method/headers/query/ip/user-agent/body)
  |
  +--> parseSourceApplicationHeader(...) (utils/parse-source-application-header.util.ts)
  |       uses request.get('x-source-app')
  |
  +--> parseRetryCountHeader(...) (utils/parse-retry-count-header.util.ts)
  |       uses request.get('x-retry-count')
  |
  +--> captureUnknownPayload(...) (utils/capture-unknown-payload.util.ts)
  |       converts request/response/error values into ApiCapturedPayload
  |
  +--> buildApiExchangeSummary(contextService, ...) (utils/build-api-exchange-summary.util.ts)
  |       uses ApiRequestContextService -> reads async-context store (correlationId/actor/etc.)
  |
  +--> creates ApiExchangeEvent (domain/api-exchange.event.ts is the type blueprint)
  |
  +--> notifyHost(event)
          calls host-provided onApiExchange(event) (token API_INTERCEPTOR_ON_EXCHANGE)
```

## Who consumes what (quick list)

- **Host app consumes**
  - `ApiInterceptorModule.forRoot({ asyncContext, onApiExchange, ... })`
  - `ApiRequestContextService` (optional; to write actor info to the async store)
  - `ApiExchangeEvent` types (to type `onApiExchange`)

- **Interceptor consumes**
  - `ApiRequestContextService` (async context reads/writes)
  - `captureUnknownPayload` (payload snapshots)
  - `buildApiExchangeSummary` (summary row)
  - `parseSourceApplicationHeader` / `parseRetryCountHeader` (header extraction)

