// @exprealty/shared-domain/logging.ts
import { z } from 'zod'
import { CapabilityEnum, ServiceIdSchema } from './capabilities.js'
export const EnvEnum = z.enum(['local', 'dev', 'test', 'prod'])
export const HttpMethodEnum = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Keep endpoints “sluggy” (no IDs). e.g., "/demographics" or "listing/search"
 * If you need subpaths, dash/alpha-num only to keep Loki labels safe.
 */
export const EndpointSlug = z
  .string()
  .min(1)
  .regex(/^\/?[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i, 'use slugified endpoint path (no IDs)')


  export const ServiceCallEventSchema = z.object({
  event: z.literal('service_call'),
  service: z.string().min(1),               // e.g., "orchestrator"
  env: EnvEnum,                              // "dev" | "test" | "prod"

  // Your service IDs like "agent:contries", "agent:mls", "agent:address"
  serviceCall: ServiceIdSchema,

  // Optional but very useful for dashboards: "listing.search", "address.geocode", etc.
  capability: CapabilityEnum.optional(),

  endpoint: EndpointSlug,                    // normalized slug (no IDs)
  method: HttpMethodEnum.default('GET'),

  status: z.number().int().min(0).max(599),
  ok: z.boolean(),

  duration_ms: z.number().finite().min(0),

  retries: z.number().int().min(0).default(0),

  // Helpful for correlation, but do NOT make these Loki labels
  request_id: z.string().uuid().optional(),
  error_kind: z.string().optional(),         // e.g., "ECONNABORTED", "ETIMEDOUT"
})

export type ServiceCallEvent = z.infer<typeof ServiceCallEventSchema>

// ─── Schema Version ──────────────────────────────────────────────────────────
export const LOG_SCHEMA_VERSION = '1.0.0';

export type LogChannel =
  | 'operational'
  | 'lifecycle'
  | 'diagnostic'
  | 'security'
  | 'default';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ---------------------------------------------------------------------------
// Log Envelope — structured metadata for tier-aware logging
// ---------------------------------------------------------------------------

/**
 * Typed metadata envelope for tier-aware log methods.
 *
 * `channel` is the primary routing/search field for CloudWatch and Datadog:
 *   - CloudWatch: `{ $.channel = "perf" }`
 *   - Datadog:    `@channel:perf`
 *
 * The index signature allows arbitrary domain-specific fields alongside
 * the known envelope fields.
 */
export interface LogEnvelope<TData = Record<string, unknown>> {
  
  /** Envelope schema version. Consumers use this for backward compat. */
  schema: string

  // ── Source identity ──
  service: string;
  /** Service build/deploy version */
  serviceVersion: string;
  /** Runtime environment */
  env: string;

  // ── Timestamp ──
  /** ISO 8601 UTC timestamp */
  timestamp: string;

  // ── Severity ──
  /** Standard severity level — never used for routing decisions */
  level: LogLevel;

  // ── Routing ──
  /** Routing channel — Fluent Bit uses this to decide destinations */
  channel: LogChannel;

  // ── Event typing ──
  /**
   * Dot-delimited event identifier.
   * Convention: <domain>.<entity>.<action>
   * Examples: "mls.sync.completed", "billing.invoice.failed", "auth.login.succeeded"
   * Use "log" for untyped/freeform messages.
   */
  event: string;

  // ── Human-readable message ──
  /** Brief description — what happened, not the full context (that's in data) */
  msg: string;

  // ── Trace correlation ──
  // dd-trace automatically injects `dd.trace_id` and `dd.span_id` into every
  // Winston log line when `DD_LOGS_INJECTION=true` (or logInjection: true).
  // These fields are NOT part of the envelope schema — they are injected at
  // the transport layer by the Datadog tracer and should not be set by
  // application code.

  /** Acting user identifier when applicable */
  userId?: string;

  // ── Request context ──
  /** Inbound request ID (X-Request-Id or generated) */
  requestId?: string;

  // ── Domain payload ──
  /**
   * Event-specific structured data. Shape is determined by the `event` field.
   * Typed per-event via the EventMap and LogEvent utility type.
   */
  data: TData;

  // ── Error context (when level is error or fatal) ──
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // ── Arbitrary tags for Datadog/CloudWatch ──
  tags?: Record<string, string>;
}