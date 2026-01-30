# API Monitoring & Observability Package

## Overview

Enterprise-grade API monitoring and observability package for NestJS applications. Provides comprehensive HTTP request monitoring, metrics, and observability that can be shared across multiple services.

## Installation

This package is part of the monorepo workspace. To use it in a service:

1. Add to your service's `package.json`:
```json
{
  "dependencies": {
    "@exprealty/api-monitoring": "workspace:*"
  }
}
```

2. Install dependencies:
```bash
pnpm install
```

## Usage

### Basic Setup

Import and configure the module in your NestJS application:

```typescript
import { ApiMonitoringModule } from '@exprealty/api-monitoring';
import { LoggerService } from './core/logger.service';

@Module({
  imports: [
    ApiMonitoringModule.forRoot({
      logger: LoggerService, // Your logger that implements IApiMonitoringLogger
    }),
  ],
})
export class AppModule {}
```

### Logger Interface

Your logger service must implement the `IApiMonitoringLogger` interface:

```typescript
import { IApiMonitoringLogger } from '@exprealty/api-monitoring';

export class MyLoggerService implements IApiMonitoringLogger {
  setContext(context: string): void { /* ... */ }
  info(message: string, meta?: Record<string, unknown>): void { /* ... */ }
  error(message: string, meta?: Record<string, unknown>): void { /* ... */ }
  warn(message: string, meta?: Record<string, unknown>): void { /* ... */ }
  debug(message: string, meta?: Record<string, unknown>): void { /* ... */ }
}
```

### Middleware Configuration

The module automatically registers:
- Global interceptor for request/response capture
- Middleware for actor attribution (requires manual registration in `AppModule.configure()`)

To register the actor middleware:

```typescript
import { ApiActorMiddleware } from '@exprealty/api-monitoring';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiActorMiddleware)
      .forRoutes('*');
  }
}
```

### Customizing Actor Extraction

Customize `ApiActorMiddleware.extractActorFromRequest()` based on your authentication:

```typescript
// Override in your service or extend the middleware
private extractActorFromRequest(req: Request) {
  // @ts-expect-error - user set by auth middleware
  const user = req.user;
  if (user?.id) {
    return {
      type: ApiActorType.USER,
      identifier: user.email,
      metadata: { userId: user.id },
    };
  }
  // ... handle API keys, service accounts, etc.
}
```

## Architecture

### Components

1. **ApiMonitoringInterceptor** (Global Interceptor)
   - Captures all HTTP requests/responses
   - Measures latency
   - Extracts request metadata (IP, user agent, sizes)
   - Logs asynchronously (non-blocking)

2. **ApiActorMiddleware** (Middleware)
   - Attributes requests to actors (users, API keys, service accounts)
   - Runs after authentication middleware
   - Creates/updates actor records in database

3. **ApiMonitoringService** (Service)
   - High-volume request logging
   - Error classification and PII sanitization
   - Stack trace capture (server errors only)
   - Sampling support for high-throughput

4. **ApiMetricsService** (Service)
   - Time-series metrics aggregation
   - Latency percentile calculations
   - Route breakdown statistics
   - Top callers analysis
   - Trends metrics with period-over-period deltas
   - Available routes and error codes queries

5. **ApiMonitoringController** (Controller)
   - Internal-only admin endpoints
   - Dashboard data APIs
   - Protected by role-based access (add guards in your service)

### Data Model

#### ApiActorEntity
- Tracks external actors (users, API keys, service accounts)
- Created on-demand when first seen
- Used for request attribution and security monitoring

#### ApiRequestLogEntity
- High-volume, append-only request log
- Indexed for time-range queries
- Optimized for aggregation queries
- Supports retention policies (hot vs cold data)

#### ApiRouteStatsEntity
- Pre-aggregated statistics by route, method, and time bucket
- Updated by background workers
- Enables fast dashboard queries without scanning raw logs

## Configuration

### Environment Variables

```bash
# Enable/disable monitoring (default: true)
API_MONITORING_ENABLED=true

# Sampling rate 0.0-1.0 (default: 1.0 = 100%)
# Use < 1.0 for high-throughput scenarios
API_MONITORING_SAMPLE_RATE=1.0

# Exclude requests from specific origins (comma-separated)
# Examples: "nexus.example.com" or "nexus,app" (matches any domain containing these strings)
# Localhost requests are always excluded regardless of this setting
API_MONITORING_EXCLUDE_ORIGINS=nexus
```

## Database Setup

Run the migration to create the monitoring tables:

```bash
# Migration file: 1769500000000-CreateApiMonitoringTables.ts
pnpm migration:run
```

## Querying Metrics

Use the admin endpoints for dashboard data:

```bash
# Summary metrics (for admin header/dashboard)
GET /v1/api-monitoring/summary?from=2024-01-01&to=2024-01-02

# Time-series metrics
GET /v1/api-monitoring/metrics/time-series?startTime=2024-01-01&endTime=2024-01-02&timeBucket=hour

# Route breakdown
GET /v1/api-monitoring/metrics/routes?startTime=2024-01-01&endTime=2024-01-02&limit=50

# Top callers
GET /v1/api-monitoring/metrics/top-callers?startTime=2024-01-01&endTime=2024-01-02&limit=20

# Long-term trends (30, 60, or 90 days)
GET /v1/api-monitoring/trends?range=30d&route=/v1/agents&statusCode=200

# Actor activity
GET /v1/api-monitoring/actors/{actorId}/activity?startTime=2024-01-01&endTime=2024-01-02

# Error samples
GET /v1/api-monitoring/errors/samples?startTime=2024-01-01&endTime=2024-01-02&classification=server_error

# Available routes and error codes (for filter dropdowns)
GET /v1/api-monitoring/routes/available?startDate=2024-01-01&endDate=2024-01-02

# Manual aggregation trigger (admin only)
GET /v1/api-monitoring/aggregate?startTime=2024-01-01&endTime=2024-01-02&timeBucket=hour
```

## Performance Considerations

1. **Non-blocking I/O**: All logging is asynchronous
2. **Sampling**: Use `API_MONITORING_SAMPLE_RATE` for high-throughput
3. **Background Aggregation**: Route stats are pre-aggregated by workers
4. **Indexes**: Optimized for time-range queries
5. **Error Isolation**: Monitoring failures never break requests

## Security

- **PII Sanitization**: Error messages are sanitized (emails, phones, SSNs removed)
- **Stack Traces**: Only captured for server errors (5xx)
- **Admin Endpoints**: Should be protected with role-based access control
  - **Important**: The `ApiMonitoringController` endpoints are NOT protected by default
  - You MUST add role-based access control guards in your service:
  ```typescript
  @UseGuards(RolesGuard)
  @Roles('admin', 'monitoring')
  export class ApiMonitoringController { ... }
  ```
- **No Payload Logging**: Request/response bodies are not logged by default

## Shared Package Benefits

- **Single Source of Truth**: One implementation for all services
- **Consistent Behavior**: Same monitoring logic across services
- **Easy Updates**: Update once, all services benefit
- **Type Safety**: Shared types ensure consistency

## Future Enhancements

- Prometheus/OpenTelemetry export
- Real-time alerting
- Suspicious behavior detection
- Rate limiting integration
- Distributed tracing support

