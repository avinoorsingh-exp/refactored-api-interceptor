# `@exprealty/api-interceptor` — package reference

This package provides **HTTP exchange observation** for NestJS applications. It does **not** define PostgreSQL tables, metrics HTTP APIs, or TypeORM entities.

## Concepts

- **`ApiInterceptorModule.forRoot`**: registers a **global** `ApiInterceptor`, runtime options, your **`onApiExchange`** handler, and **`ApiRequestContextService`**.
- **`onApiExchange`**: receives **`ApiExchangeEvent`** for phases **`completed`**, **`error`**, and **`skipped`**.
- **`IApiInterceptorAsyncContext`**: you supply a class token; the module instantiates it and injects it where the interceptor reads correlation and store fields.

## Headers

- **`x-source-app`**: calling product label (parsed by `parseSourceApplicationHeader`; constant `API_INTERCEPTOR_SOURCE_APP_HEADER`).
- **`x-retry-count`**: non-negative retry counter for replays (`parseRetryCountHeader`; constant `API_INTERCEPTOR_RETRY_COUNT_HEADER`).

## Environment

- **`API_INTERCEPTOR_EXCLUDE_ORIGINS`**: comma-separated substrings matched against request **Origin** / **Referer** hostnames to force the **skipped** path for those requests.

For the end-to-end file layout, see [request-flow.md](./request-flow.md).
