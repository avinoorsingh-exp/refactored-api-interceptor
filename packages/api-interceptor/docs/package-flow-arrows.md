# File-to-file flow (arrows) — `@exprealty/api-interceptor`

This page shows how the **main source files** in this package **point to each other** (imports/exports) and where they’re **consumed at runtime**.

## Public entry (what consumers import)

```mermaid
flowchart TD
  Host[Host app] -->|import { ApiInterceptorModule } from '@exprealty/api-interceptor'| Index[src/index.ts]

  Index --> Mod[src/api-interceptor.module.ts\n(ApiInterceptorModule)]
  Index --> Interceptor[src/interceptors/api-interceptor.interceptor.ts\n(ApiInterceptor)]
  Index --> CtxSvc[src/services/api-request-context.service.ts\n(ApiRequestContextService)]
  Index --> DomainEvent[src/domain/api-exchange.event.ts\n(ApiExchangeEvent, ApiCapturedPayload, ...)]
  Index --> DomainTypes[src/domain/api-interceptor.types.ts\n(HttpMethod, ApiActorType, ApiErrorClassification)]
  Index --> HeaderUtils[src/utils/parse-*.util.ts\n(parseSourceApplicationHeader, parseRetryCountHeader)]
```

## Registration wiring (what `forRoot` sets up)

```mermaid
flowchart TD
  ForRoot[src/api-interceptor.module.ts\nApiInterceptorModule.forRoot(options)] --> DM[DynamicModule]

  DM --> Opts[API_INTERCEPTOR_MODULE_OPTIONS\n(runtime capture flags/limits)]
  DM --> OnEx[API_INTERCEPTOR_ON_EXCHANGE\n(host callback function)]
  DM --> AsyncCtx[API_INTERCEPTOR_ASYNC_CONTEXT\n(useClass: options.asyncContext)]
  DM --> CtxSvc[ApiRequestContextService]
  DM --> AppInt[APP_INTERCEPTOR -> ApiInterceptor\n(global interceptor)]
```

## Runtime flow (what happens per request)

```mermaid
flowchart TD
  Req[Incoming HTTP request\n(to host Nest app)] --> Int[src/interceptors/api-interceptor.interceptor.ts\nApiInterceptor.intercept]

  Int --> ReadReq[Read request details\n(route/method/headers/query/ip/user-agent/body)]
  Int --> SrcApp[src/utils/parse-source-application-header.util.ts\nparseSourceApplicationHeader(request.get)]
  Int --> Retry[src/utils/parse-retry-count-header.util.ts\nparseRetryCountHeader(request.get)]
  Int --> Capture[src/utils/capture-unknown-payload.util.ts\ncaptureUnknownPayload(...)\n(ApiCapturedPayload)]
  Int --> Summary[src/utils/build-api-exchange-summary.util.ts\nbuildApiExchangeSummary(contextService, ...)]

  Summary --> CtxSvc[src/services/api-request-context.service.ts\nApiRequestContextService]
  CtxSvc --> AsyncCtx[src/interfaces/async-context.port.ts\nIApiInterceptorAsyncContext.getStore/getCorrelationId]

  Int --> Event[src/domain/api-exchange.event.ts\nCreate ApiExchangeEvent]
  Event --> Notify[notifyHost(event)]
  Notify --> OnEx[host onApiExchange(event)\n(token API_INTERCEPTOR_ON_EXCHANGE)]
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

