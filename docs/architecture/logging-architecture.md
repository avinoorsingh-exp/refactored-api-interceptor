# Agent Service Logging Architecture

## Overview

The agent-service uses a structured logging architecture with semantic classification. The application stamps logs with `tier` and `channel` metadata. Routing decisions (index vs. archive, forward to Datadog vs. CloudWatch-only) are handled by a Fluent Bit sidecar container in the ECS task definition — not by the application.

Three layers:

1. **Application Logging** — `LoggerService` + `ScopedLogger` + `LogEnvelope`
2. **Log Routing** — Fluent Bit sidecar (routes by `channel` and `tier`)
3. **Observability** — Datadog (indexed logs, APM traces) + CloudWatch (archive)

---

## Log Tiering System

### Tier Definitions

| Tier | When to Use | Winston Level |
|------|-------------|---------------|
| **CRITICAL** | PG errors, unhandled exceptions, 5xx, process crashes | `error` |
| **OPERATIONAL** | Request/response, slow queries, job results, service ready | `info` |
| **LIFECYCLE** | Bootstrap steps, module init, route mapping, cron scheduling | `info` |
| **DEBUG** | Aggregation SQL, diagnostic queries, verbose debug traces | `debug` |

Tiers classify log importance. The application does **not** decide whether a log is indexed — that is a Fluent Bit routing decision based on `channel` and `tier`.

### How Tiering Works

```typescript
// CRITICAL — errors, exceptions, 5xx, process crashes
logger.critical('DB connection lost', { code: '08001' });

// OPERATIONAL — request/response, slow queries, job results
logger.operational('Created note for agent', { agentId, noteId, durationMs: 42 });

// LIFECYCLE — bootstrap steps, module init
logger.lifecycle('Module initialized', { module: 'TypeOrmModule' });

// DEBUG — aggregation SQL, diagnostic queries, verbose traces
logger.debugTiered('Aggregation SQL', { sql: 'SELECT ...' });
```

Each tier-aware method stamps the log with `tier`:

```json
{
  "message": "Created note for agent",
  "tier": "operational",
  "context": "NoteService",
  "agentId": "550e8400-...",
  "durationMs": 42
}
```

---

## Log Channels

Channels are the primary routing dimension. Fluent Bit uses `channel` to decide destinations.

| Channel | Description | Typical Tier |
|---------|-------------|--------------|
| `operational` | CRUD request/response, business events | OPERATIONAL, CRITICAL |
| `lifecycle` | Startup, shutdown, module init | LIFECYCLE |
| `diagnostic` | Query performance, SQL traces, verbose debug | DEBUG, OPERATIONAL |
| `security` | Auth, authorization, access control | OPERATIONAL, CRITICAL |
| `default` | Unclassified (legacy/untagged call sites) | varies |

Channels are defined as a union type in `@exprealty/shared-domain`:

```typescript
export type LogChannel =
  | 'operational'
  | 'lifecycle'
  | 'diagnostic'
  | 'security'
  | 'default';
```

---

## Log Envelope

`LogEnvelope<TData>` is the structured metadata contract for all log output. Defined in `packages/shared-domain/src/common/logging.ts`.

```typescript
export interface LogEnvelope<TData = Record<string, unknown>> {
  schema: string;            // Envelope schema version (LOG_SCHEMA_VERSION)
  service: string;           // e.g., "agent-service"
  serviceVersion: string;    // Build/deploy version
  env: string;               // "local" | "dev" | "test" | "prod"
  timestamp: string;         // ISO 8601 UTC
  level: LogLevel;           // "debug" | "info" | "warn" | "error" | "fatal"
  channel: LogChannel;       // Routing channel for Fluent Bit
  event: string;             // Dot-delimited: "agent.note.created"
  msg: string;               // Human-readable message
  userId?: string;           // Acting user identifier
  requestId?: string;        // Inbound request ID (X-Request-Id)
  data: TData;               // Event-specific structured payload
  error?: { name, message, stack?, code? };
  tags?: Record<string, string>;
}
```

> **Trace correlation:** `dd.trace_id` and `dd.span_id` are **not** part of the envelope schema. The Datadog tracer (`dd-trace`) automatically injects these fields into every Winston log line at the transport layer when `DD_LOGS_INJECTION=true`. Application code should never set them manually.

### Event Map

Events are registered in `packages/shared-domain/src/common/events.ts`. The `EventMap` is the central registry mapping event strings to their typed `data` payloads:

```typescript
export interface EventMap {
  'db.query.slow': DbQuerySlow;
  'db.pool.exhausted': DbConnectionPoolExhausted;
  'log': GenericLogData;  // Freeform fallback
}
```

Events are kept generic for now and will be expanded as modules adopt the envelope.

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared-domain/src/common/logging.ts` | `LogEnvelope`, `LogChannel`, `LogLevel`, `LOG_SCHEMA_VERSION` |
| `packages/shared-domain/src/common/events.ts` | `EventMap`, event data interfaces |
| `packages/logger/src/log-tier.ts` | `LogTier` enum |
| `services/agent-service/src/core/logger.service.ts` | `LoggerService` singleton + `ScopedLogger` class |

---

## LoggerService Architecture

### Singleton + ScopedLogger Pattern

`LoggerService` is a NestJS singleton injected into every controller, service, and middleware. This means **`setContext()` is fundamentally broken** — it mutates shared state, and the last caller wins:

```
Startup (constructors run once, outside request context):
  NoteController  → logger.setContext('NoteController')   → this.context = 'NoteController'
  AgentController → logger.setContext('AgentController')   → this.context = 'AgentController' ← wins

During any request:
  getLoggerContext() → falls back to this.context → 'AgentController' for ALL routes
```

**`setContext()` must not be used.** Use `createScopedLogger()` instead:

```typescript
@Injectable()
export class NoteController {
  private readonly logger: ScopedLogger;

  constructor(logger: LoggerService) {
    this.logger = logger.createScopedLogger('NoteController');
  }
}
```

`ScopedLogger` delegates to the same Winston instance but always stamps its own fixed `context`. It never reads `AsyncContextStorage` or the singleton's `this.context`. Each class gets its own isolated context regardless of construction order or middleware behavior.

> **Why not just fix `setContext()`?** The problem is architectural: a singleton cannot hold per-class state. `setContext()` is preserved only for backward compatibility with code we don't own (e.g., `@exprealty/api-monitoring`). All new code and all code we own should use `createScopedLogger()`.

### Method Reference

| Method | Tier | Winston Level |
|--------|------|---------------|
| `critical(msg, meta?)` | CRITICAL | `error` |
| `operational(msg, meta?)` | OPERATIONAL | `info` |
| `lifecycle(msg, meta?)` | LIFECYCLE | `info` |
| `debugTiered(msg, meta?)` | DEBUG | `debug` |
| `info(msg, meta?)` | _(none)_ | `info` |
| `error(msg, meta?)` | _(none)_ | `error` |
| `warn(msg, meta?)` | _(none)_ | `warn` |
| `debug(msg, meta?)` | _(none)_ | `debug` |

The untiered methods (`info`, `error`, `warn`, `debug`) are preserved for backward compatibility. They do not stamp `tier`. New code should use tier-aware methods.

---

## Call Site Tagging — Uptake Status

Tier-aware methods and `createScopedLogger` must be adopted incrementally. Bulk changes are deferred as tech debt.

### Tagged (complete)

| Area | Files | Calls | Notes |
|------|-------|-------|-------|
| Notes module | 2 | 5 | `operational` + `debugTiered`, uses `createScopedLogger` |
| QueryPerformanceInterceptor | 1 | 10 | `operational`, `critical`, `debugTiered`, `channel: 'diagnostic'` |

### Untagged (tech debt)

| Directory | Files | Owner | Priority |
|-----------|-------|-------|----------|
| `modules/kafka/` | 18 | Kafka team | Do not change (not owned) |
| `modules/agents/` (non-notes) | 8 | Agent team | Medium |
| `modules/` (other domains) | 29 | Various | Medium |
| `common/` | 7 | Platform | Medium |
| `core/` | 1 | Platform | Low (logger itself) |
| **Total** | **63** | | |

### Uptake Pattern for New Call Sites

When converting an existing call site, both changes should be made together:

**Step 1 — Replace `setContext()` with `createScopedLogger()`**

```typescript
// BEFORE (broken — singleton shared state)
import { LoggerService } from '../../../core/logger.service.js';

constructor(private readonly logger: LoggerService) {
  this.logger.setContext('MyService');
}

// AFTER (correct — isolated context)
import { LoggerService, ScopedLogger } from '../../../core/logger.service.js';

private readonly logger: ScopedLogger;
constructor(logger: LoggerService) {
  this.logger = logger.createScopedLogger('MyService');
}
```

**Step 2 — Replace untiered methods with tier-aware methods**

```typescript
// BEFORE
this.logger.info(`Created record ${id}`);
this.logger.error(`Failed to create record`, { error });
this.logger.debug(`SQL: ${sql}`);

// AFTER
this.logger.operational(`Created record ${id}`);
this.logger.critical(`Failed to create record`, { error });
this.logger.debugTiered(`SQL: ${sql}`);
```

**Step 3 — Update test mocks**

```typescript
// Service spec: mock LoggerService with createScopedLogger
const mockLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  operational: jest.fn(),
  critical: jest.fn(),
  lifecycle: jest.fn(),
  debugTiered: jest.fn(),
  // ... other methods
};

const mockLoggerService = {
  createScopedLogger: jest.fn().mockReturnValue(mockLogger),
} as unknown as LoggerService;

// Controller spec (TestingModule): provide mock with createScopedLogger
{
  provide: LoggerService,
  useValue: { createScopedLogger: jest.fn().mockReturnValue(mockChildLogger) },
}
```

---

## Structured Log Payloads

### Performance Logs (QueryPerformanceInterceptor)

The `[Microscope]` perf interceptor emits structured payloads with namespaced fields:

```json
{
  "message": "[Microscope] Slow query detected",
  "tier": "operational",
  "channel": "diagnostic",
  "correlationId": "abc-123",
  "endpoint": {
    "method": "GET",
    "path": "/v1/agents",
    "controller": "AgentController",
    "handler": "findAll"
  },
  "perf": {
    "durationMs": 1250,
    "thresholdMs": 500,
    "severity": "slow"
  },
  "query": {
    "sql": "SELECT ... FROM core.agent ...",
    "parameters": ["..."]
  }
}
```

Filter in CloudWatch: `{ $.channel = "diagnostic" }`
Filter in Datadog: `@channel:diagnostic`

---

## Log Routing — Fluent Bit Sidecar

### Design Decision

Routing decisions (which logs go to Datadog, which stay in CloudWatch) are owned by the **Fluent Bit sidecar**, not the application. The application classifies logs with `tier` and `channel`; Fluent Bit reads those fields and routes accordingly.

This means:
- Changing routing rules does not require an application redeploy
- Developers classify logs semantically, not by infrastructure cost
- Different environments can have different routing (perf forwards everything, prod is selective)

### ECS Architecture

Both containers are defined in the same ECS task definition. Fluent Bit reads the app container's stdout via the `awsfirelens` log driver.

```
┌──────────────────────────────────────────────────────┐
│ ECS Task Definition                                  │
│                                                      │
│  ┌──────────────┐  stdout   ┌─────────────────────┐  │
│  │ agent-service │─────────▶│  Fluent Bit          │  │
│  │  (app)        │          │  (sidecar container) │  │
│  └──────────────┘          └──────────┬──────────┘  │
│                                       │              │
│  ┌──────────────┐                     │              │
│  │ Datadog Agent │ ◀── APM traces ──  │              │
│  │  (sidecar)    │                    │              │
│  └──────────────┘                     │              │
│                                       │              │
└───────────────────────────────────────┼──────────────┘
                                        │
                             ┌──────────┴──────────┐
                             │                     │
                             ▼                     ▼
                      ┌────────────┐       ┌──────────────┐
                      │  Datadog    │       │  CloudWatch   │
                      │  (indexed)  │       │  (archived)   │
                      └────────────┘       └──────────────┘
```

### Fluent Bit Routing Logic (planned)

PII redaction runs as a FILTER before any OUTPUT — sensitive data is scrubbed before it reaches CloudWatch or Datadog.

```
INPUT: stdout from agent-service container (awsfirelens log driver)

FILTER: Parse JSON, extract channel + tier
FILTER: PII redaction (regex scrub SSN, EIN, email, etc.) — runs before all OUTPUT

MATCH channel=operational OR channel=security:
  → OUTPUT: Datadog (indexed)
  → OUTPUT: CloudWatch (archived)

MATCH channel=lifecycle:
  → OUTPUT: CloudWatch (archived only)

MATCH channel=diagnostic:
  → OUTPUT: CloudWatch (archived only)
  → IF tier=critical → ALSO OUTPUT: Datadog

MATCH channel=default:
  → OUTPUT: CloudWatch (archived only)
```

### Environment Variables (Datadog Agent Sidecar)

These are set on the Datadog Agent sidecar container in the ECS task definition:

| Variable | Description | Example |
|----------|-------------|---------|
| `DD_API_KEY` | Datadog API key (from Secrets Manager) | `(secret)` |
| `DD_SITE` | Datadog intake site | `datadoghq.com` |
| `DD_ENV` | Environment tag | `dev`, `perf`, `prod` |
| `DD_SERVICE` | Service name | `agent-service` |
| `DD_VERSION` | Service version | `0.1.0` |
| `DD_APM_ENABLED` | Enable APM trace collection | `true` |
| `DD_APM_NON_LOCAL_TRAFFIC` | Accept traces from other containers | `true` |
| `DD_DOGSTATSD_NON_LOCAL_TRAFFIC` | Accept metrics from other containers | `true` |
| `DD_LOGS_ENABLED` | Enable log collection | `true` |
| `DD_PROCESS_AGENT_ENABLED` | Enable process monitoring | `true` |
| `DD_TAGS` | Additional tags | `team:platform cloud:aws region:us-east-1` |
| `DD_HOSTNAME` | Hostname for Datadog UI | `agent-service-${DD_ENV}` |

### Local Development (Docker Compose)

```yaml
services:
  datadog-agent:
    image: gcr.io/datadoghq/agent:7
    environment:
      DD_API_KEY: ${DD_API_KEY:-}
      DD_SITE: ${DD_SITE:-datadoghq.com}
      DD_ENV: ${DD_ENV:-dev}
      DD_SERVICE: agent-service
      DD_VERSION: "0.1.0"
      DD_APM_ENABLED: "true"
      DD_APM_NON_LOCAL_TRAFFIC: "true"
      DD_DOGSTATSD_NON_LOCAL_TRAFFIC: "true"
      DD_LOGS_ENABLED: "true"
      DD_PROCESS_AGENT_ENABLED: "true"
      DD_TAGS: "team:platform cloud:local region:local"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
    ports:
      - "8126:8126"   # APM trace receiver
      - "8125:8125/udp" # DogStatsD
```

---

## Querying Logs

### Datadog

```
# Find all critical logs
@tier:critical

# Find operational logs for the agent service
service:agent-service @tier:operational

# Find diagnostic logs (perf, SQL traces)
@channel:diagnostic

# Find logs for a specific agent
@agentId:550e8400-e29b-41d4-a716-446655440000
```

### CloudWatch

```
# Find lifecycle logs (not in Datadog)
{ $.tier = "lifecycle" }

# Find diagnostic logs
{ $.channel = "diagnostic" }

# Find all logs for a correlation ID
{ $.correlationId = "abc-123" }
```

---

## Remaining Work

### LogEnvelope Integration

Wire `LogEnvelope` into `LoggerService` so tier-aware methods produce the full envelope shape, not just `tier` + freeform meta. This includes:

- Stamp `schema`, `service`, `serviceVersion`, `env`, `timestamp` automatically
- Map tier methods to their `channel` (e.g., `operational()` → `channel: 'operational'`)
- Accept `event` string for typed event payloads
- Auto-inject `requestId` from `AsyncContextStorage` when available

### Fluent Bit Sidecar (ECS Task Definition)

Fluent Bit runs as a sidecar container in the same ECS task definition as the application container. It reads stdout from the app container and routes logs based on `channel` and `tier`.

- Define Fluent Bit as a sidecar container in the ECS task definition
- Use the AWS-provided `amazon/aws-for-fluent-bit` image with a custom config file (mounted via S3 or inline)
- Route by `channel` field to Datadog vs. CloudWatch
- Add PII redaction filter upstream of all OUTPUT plugins
- No custom Docker image needed — config is injected at task definition level

### dd-trace Wiring

The Datadog APM tracer (`dd-trace`) automatically injects `dd.trace_id` and `dd.span_id` into every Winston log line at the transport layer. These fields are **not** part of the `LogEnvelope` schema — application code never sets them.

- Install `dd-trace` package
- Add `import 'dd-trace/init'` as the first import in `main.ts`
- Set `DD_LOGS_INJECTION=true` (or `logInjection: true` in tracer config)
- Configure via env vars: `DD_ENV`, `DD_SERVICE`, `DD_VERSION`, `DD_AGENT_HOST`
- Verify `dd.trace_id` and `dd.span_id` appear in structured log output

### PII Redaction

Scrub sensitive fields before logs reach any destination (CloudWatch or Datadog):

- Define redaction pattern list (regex for SSN, EIN, email, etc.)
- Implement in Fluent Bit filter (preferred) or Winston transport (fallback)
- PII must be scrubbed before routing — the filter runs upstream of all OUTPUT plugins
- Verify with test payloads

### Call Site Tagging (tech debt)

63 files still use untiered methods. Adopt incrementally per the uptake pattern above.

---

## Local Development vs Production

| Aspect | Local (Docker) | Perf (ECS) | Production (ECS) |
|--------|----------------|------------|------------------|
| Log Format | JSON (Winston) | JSON (Winston) | JSON (Winston) |
| Debug Logs | Visible in console | CloudWatch only | CloudWatch only |
| Routing | Not enforced | Fluent Bit by channel | Fluent Bit by channel |
| Datadog Agent | Optional compose sidecar | ECS sidecar | ECS sidecar |
| APM Traces | Optional | Enabled | Enabled |
| Perf Interceptor | Configurable via env | On for load tests | Off |
