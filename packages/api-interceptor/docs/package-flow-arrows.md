# File-to-file flow (arrows) — `@exprealty/api-interceptor`

This page shows how the **main source files** in this package **point to each other** (imports/exports) and where they’re **consumed at runtime**.

## Public entry (what consumers import)

```mermaid
flowchart TD
  Host[Host app] -->|imports ApiInterceptorModule from package| Index[src/index.ts]

  Index --> Mod["src/api-interceptor.module.ts<br/>ApiInterceptorModule"]
  Index --> Interceptor["src/interceptors/api-interceptor.interceptor.ts<br/>ApiInterceptor"]
  Index --> CtxSvc["src/services/api-request-context.service.ts<br/>ApiRequestContextService"]
  Index --> DomainEvent["src/domain/api-exchange.event.ts<br/>ApiExchangeEvent + ApiCapturedPayload"]
  Index --> DomainTypes["src/domain/api-interceptor.types.ts<br/>HttpMethod + ApiActorType + ApiErrorClassification"]
  Index --> HeaderUtils["src/utils/parse-*.util.ts<br/>parseSourceApplicationHeader + parseRetryCountHeader"]
```

## Registration wiring (what `forRoot` sets up)

```mermaid
flowchart TD
  ForRoot["src/api-interceptor.module.ts<br/>ApiInterceptorModule.forRoot"] --> DM[DynamicModule]

  DM --> Opts["API_INTERCEPTOR_MODULE_OPTIONS<br/>runtime capture flags/limits"]
  DM --> OnEx["API_INTERCEPTOR_ON_EXCHANGE<br/>host callback function"]
  DM --> AsyncCtx["API_INTERCEPTOR_ASYNC_CONTEXT<br/>useClass: options.asyncContext"]
  DM --> CtxSvc["ApiRequestContextService"]
  DM --> AppInt["APP_INTERCEPTOR -> ApiInterceptor<br/>global interceptor"]
```

## Runtime flow (what happens per request)

```mermaid
flowchart TD
  Req["Incoming HTTP request<br/>(to host Nest app)"] --> Int["src/interceptors/api-interceptor.interceptor.ts<br/>ApiInterceptor.intercept"]

  Int --> ReadReq["Read request details<br/>route/method/headers/query/ip/user-agent/body"]
  Int --> SrcApp["src/utils/parse-source-application-header.util.ts<br/>parseSourceApplicationHeader(request.get)"]
  Int --> Retry["src/utils/parse-retry-count-header.util.ts<br/>parseRetryCountHeader(request.get)"]
  Int --> Capture["src/utils/capture-unknown-payload.util.ts<br/>captureUnknownPayload(...)<br/>ApiCapturedPayload"]
  Int --> Summary["src/utils/build-api-exchange-summary.util.ts<br/>buildApiExchangeSummary(contextService, ...)"]

  Summary --> CtxSvc["src/services/api-request-context.service.ts<br/>ApiRequestContextService"]
  CtxSvc --> AsyncCtx["src/interfaces/async-context.port.ts<br/>IApiInterceptorAsyncContext.getStore + getCorrelationId"]

  Int --> Event["src/domain/api-exchange.event.ts<br/>Create ApiExchangeEvent"]
  Event --> Notify[notifyHost(event)]
  Notify --> OnEx["host onApiExchange(event)<br/>token API_INTERCEPTOR_ON_EXCHANGE"]
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

