# API Monitoring & Observability System

## Overview

Enterprise-grade API monitoring and observability system for tracking all inbound HTTP traffic, attributing requests to actors, and providing comprehensive metrics and analytics.

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

5. **ApiMonitoringController** (Controller)
   - Internal-only admin endpoints
   - Dashboard data APIs
   - Protected by role-based access (TODO: add guards)

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
```

## Usage

### Automatic Instrumentation

The system automatically instruments all HTTP requests via:
- Global interceptor (captures all routes)
- Middleware (actor attribution)

No code changes needed in controllers - monitoring is transparent.

### Customizing Actor Extraction

The `ApiActorMiddleware.extractActorFromRequest()` method should be customized based on your authentication implementation:

```typescript
// Example: JWT-based authentication
private extractActorFromRequest(req: Request) {
  // @ts-expect-error - user set by JWT auth middleware
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

### Querying Metrics

Use the admin endpoints for dashboard data:

```bash
# Time-series metrics
GET /v1/api-monitoring/metrics/time-series?startTime=2024-01-01&endTime=2024-01-02&timeBucket=hour

# Route breakdown
GET /v1/api-monitoring/metrics/routes?startTime=2024-01-01&endTime=2024-01-02&limit=50

# Top callers
GET /v1/api-monitoring/metrics/top-callers?startTime=2024-01-01&endTime=2024-01-02&limit=20

# Actor activity
GET /v1/api-monitoring/actors/{actorId}/activity?startTime=2024-01-01&endTime=2024-01-02

# Error samples
GET /v1/api-monitoring/errors/samples?startTime=2024-01-01&endTime=2024-01-02&classification=server_error
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
- **No Payload Logging**: Request/response bodies are not logged by default

## Future Enhancements

- Prometheus/OpenTelemetry export
- Real-time alerting
- Suspicious behavior detection
- Rate limiting integration
- Distributed tracing support


