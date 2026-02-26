// services/agent-service/src/core/logger.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { createLogger, type Logger as WinstonLogger } from '@exprealty/logger'
import { LogTier } from '@exprealty/logger/log-tier'
import { MetricsService, type ExporterProtocol } from '@exprealty/logger/metrics'
import { z } from 'zod'
import { AsyncContextStorage } from '@exprealty/cache'

import {
  ServiceCallEventSchema,
  type ServiceCallEvent,
  EnvEnum,
  LOG_SCHEMA_VERSION,
  type LogChannel,
} from '@exprealty/shared-domain'

// ── Tier → default channel mapping ───────────────────────────────────────────
// Callers can override channel in meta (e.g. `{ channel: 'diagnostic' }`).
const TIER_CHANNEL: Record<string, LogChannel> = {
  [LogTier.CRITICAL]: 'operational',
  [LogTier.OPERATIONAL]: 'operational',
  [LogTier.LIFECYCLE]: 'lifecycle',
  [LogTier.DEBUG]: 'diagnostic',
}

/**
 * Bootstrap-safe logger service.
 *
 * Architecture:
 * - Constructor: Minimal setup, console-only, no dependencies
 * - Post-bootstrap: Initializes Winston logger and metrics via OnModuleInit
 * - All operations wrapped in try/catch to never throw
 * 
 * Dependencies:
 * - NO ConfigService dependency (uses process.env directly)
 * - NO file system writes in constructor
 * - NO network calls in constructor
 * - All heavy operations deferred to onModuleInit
 */
@Injectable()
export class LoggerService implements OnModuleInit {
  private logger: WinstonLogger | null = null
  private metrics: MetricsService | null = null
  private readonly service = 'agent-service'
  private readonly serviceVersion: string
  private readonly env: z.infer<typeof EnvEnum>
  private context?: string
  private initialized = false

  /**
   * Bootstrap-safe constructor.
   * Uses only process.env and console logging.
   * No dependencies, no file I/O, no network calls.
   */
  constructor() {
    // Use process.env directly - no ConfigService dependency
    this.env = (process.env.NODE_ENV as z.infer<typeof EnvEnum>) || 'dev'
    this.serviceVersion = process.env.SERVICE_VERSION || '0.1.0'
  }

  /**
   * Initialize Winston logger and metrics after module bootstrap.
   * This runs after all modules are initialized, so dependencies are safe.
   */
  async onModuleInit(): Promise<void> {
    try {
      // Initialize Winston logger (may perform file I/O)
      const logLevel = process.env.LOG_LEVEL || 'info'
      const logDir = process.env.LOG_DIR
      
      this.logger = createLogger({
        service: this.service,
        level: logLevel,
        logDir: logDir,
        env: this.env,
      })

      // Initialize metrics (may perform network calls)
      const headersJson = process.env.METRICS_EXPORTER_HEADERS
      let exporterHeaders: Record<string, string> = {}
      if (headersJson) {
        try {
          exporterHeaders = JSON.parse(headersJson)
        } catch (err) {
          // Fail silently - metrics headers are optional
        }
      }

      this.metrics = new MetricsService({
        service: this.service,
        version: '0.1.0',
        env: this.env,
        exporterEndpoint: process.env.METRICS_EXPORTER_ENDPOINT,
        exporterProtocol: process.env.METRICS_EXPORTER_PROTOCOL as ExporterProtocol | undefined,
        exportIntervalMillis: process.env.METRICS_EXPORT_INTERVAL_MS
          ? parseInt(process.env.METRICS_EXPORT_INTERVAL_MS, 10)
          : undefined,
        exporterHeaders,
        enableDiagnostics: process.env.METRICS_ENABLE_DIAGNOSTICS === 'true',
        diagnosticsVerbose: process.env.METRICS_DIAGNOSTICS_VERBOSE === 'true',
      })

      this.initialized = true
    } catch (err) {
      // CRITICAL: Never throw during initialization
      // Log to console as fallback
      console.error('[LoggerService] Failed to initialize Winston logger or metrics:', err)
      // Continue with console-only logging
    }
  }

  /**
   * Set the context (e.g., class name) for subsequent log messages.
   * 
   * Backward compatible: Writes to AsyncContextStorage when available,
   * otherwise falls back to local instance storage.
   */
  setContext(context: string): void {
    try {
      // Try to set in AsyncContextStorage first (request-scoped)
      const asyncContext = AsyncContextStorage.getStore()
      if (asyncContext) {
        // Set logger context in async storage
        if (!asyncContext.loggerContext) {
          asyncContext.loggerContext = {}
        }
        asyncContext.loggerContext.serviceName = context
        // Infer source type from context if not set
        if (!asyncContext.loggerContext.sourceType) {
          // Default to 'system' if not HTTP (HTTP requests have requestPath)
          asyncContext.loggerContext.sourceType = asyncContext.requestPath ? 'http' : 'system'
        }
      } else {
        // Fallback to local instance storage (for code outside async context)
        this.context = context
      }
    } catch {
      // Fail silently - logging should never break the app
    }
  }

  /**
   * Get the current logger context from AsyncContextStorage or fallback to local.
   * Returns the service name for backward compatibility.
   */
  private getLoggerContext(): string | undefined {
    try {
      // First try AsyncContextStorage (request-scoped, async-safe)
      const loggerContext = AsyncContextStorage.getLoggerContext()
      if (loggerContext?.serviceName) {
        return loggerContext.serviceName
      }
      
      // Fallback to local instance storage (for code outside async context)
      return this.context
    } catch {
      return this.context
    }
  }

  private withContext(meta?: Record<string, unknown>): Record<string, unknown> {
    try {
      const contextName = this.getLoggerContext()
      if (contextName) {
        return { context: contextName, ...meta }
      }
      return { ...meta }
    } catch {
      return meta || {}
    }
  }

  /**
   * Log info message. Never throws.
   */
  info(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.info(message, this.withContext(meta))
      } else {
        // Console fallback during bootstrap
        console.log(`[INFO] ${message}`, meta || '')
      }
    } catch {
      // Fail silently - logging should never break the app
    }
  }

  /**
   * Log error message. Never throws.
   */
  error(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.error(message, this.withContext(meta))
      } else {
        // Console fallback during bootstrap
        console.error(`[ERROR] ${message}`, meta || '')
      }
    } catch {
      // Fail silently - logging should never break the app
    }
  }

  /**
   * Log warning message. Never throws.
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.warn(message, this.withContext(meta))
      } else {
        // Console fallback during bootstrap
        console.warn(`[WARN] ${message}`, meta || '')
      }
    } catch {
      // Fail silently - logging should never break the app
    }
  }

  /**
   * Log debug message. Never throws.
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.debug(message, this.withContext(meta))
      } else {
        // Console fallback during bootstrap (only in dev/local)
        if (this.env === 'dev' || this.env === 'local') {
          console.debug(`[DEBUG] ${message}`, meta || '')
        }
      }
    } catch {
      // Fail silently - logging should never break the app
    }
  }

  // -------------------------------------------------------------------------
  // Tier-Aware Logging
  // -------------------------------------------------------------------------

  /**
   * Build envelope metadata for tier-aware log methods.
   *
   * Stamps: schema, serviceVersion, env, tier, channel, event, requestId.
   * Callers can override `channel` and `event` via meta.
   * Routing decisions (index vs. archive) are handled by Fluent Bit, not the app.
   */
  private withEnvelope(tier: LogTier, meta?: Record<string, unknown>): Record<string, unknown> {
    const { channel, event, ...rest } = meta ?? {}
    const requestId = this.getRequestId()
    return this.withContext({
      schema: LOG_SCHEMA_VERSION,
      serviceVersion: this.serviceVersion,
      env: this.env,
      tier,
      channel: (channel as LogChannel) ?? TIER_CHANNEL[tier],
      event: (event as string) ?? 'log',
      ...(requestId && { requestId }),
      ...rest,
    })
  }

  /**
   * Pull requestId from AsyncContextStorage when in a request context.
   */
  private getRequestId(): string | undefined {
    try {
      return AsyncContextStorage.getStore()?.correlationId
    } catch {
      return undefined
    }
  }

  /**
   * CRITICAL tier — errors, exceptions, 5xx, process crashes.
   */
  critical(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.error(message, this.withEnvelope(LogTier.CRITICAL, meta))
      } else {
        console.error(`[CRITICAL] ${message}`, meta || '')
      }
    } catch {
      // Fail silently
    }
  }

  /**
   * OPERATIONAL tier — request/response, slow queries, job results, service ready.
   */
  operational(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.info(message, this.withEnvelope(LogTier.OPERATIONAL, meta))
      } else {
        console.log(`[OPERATIONAL] ${message}`, meta || '')
      }
    } catch {
      // Fail silently
    }
  }

  /**
   * LIFECYCLE tier — bootstrap steps, module init, route mapping, cron scheduling.
   */
  lifecycle(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.info(message, this.withEnvelope(LogTier.LIFECYCLE, meta))
      } else {
        console.log(`[LIFECYCLE] ${message}`, meta || '')
      }
    } catch {
      // Fail silently
    }
  }

  /**
   * DEBUG tier — aggregation SQL, diagnostic queries, verbose traces.
   */
  debugTiered(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger && this.initialized) {
        this.logger.debug(message, this.withEnvelope(LogTier.DEBUG, meta))
      } else {
        if (this.env === 'dev' || this.env === 'local') {
          console.debug(`[DEBUG] ${message}`, meta || '')
        }
      }
    } catch {
      // Fail silently
    }
  }

  // -------------------------------------------------------------------------
  // Child Logger (isolated context)
  // -------------------------------------------------------------------------

  /**
   * Create a child logger with its own fixed context.
   *
   * The returned logger delegates to the same Winston instance but always
   * stamps `{ context: childContext }` — it never reads AsyncContextStorage
   * or the parent's `this.context`. This prevents the "last setContext wins"
   * bug where a shared singleton's context is overwritten by middleware.
   *
   * Usage:
   *   const log = this.logger.createScopedLogger('NoteController');
   *   log.operational('Creating note');  // context: "NoteController"
   */
  createScopedLogger(childContext: string): ScopedLogger {
    return new ScopedLogger(this, childContext)
  }

  /** @internal — exposed for ScopedLogger delegation only */
  get _winston(): WinstonLogger | null { return this.logger }
  /** @internal */
  get _initialized(): boolean { return this.initialized }
  /** @internal */
  get _env(): string { return this.env }
  /** @internal */
  get _serviceVersion(): string { return this.serviceVersion }

  // -------------------------------------------------------------------------
  // Metrics Access
  // -------------------------------------------------------------------------

  /**
   * Get the metrics service instance.
   * Returns null if not initialized (bootstrap-safe).
   */
  getMetrics(): MetricsService | null {
    try {
      return this.metrics
    } catch {
      return null
    }
  }

  /**
   * Log service call event. Never throws.
   */
  serviceCall(input: Omit<ServiceCallEvent, 'event' | 'service' | 'env'>): void {
    try {
      const parsed = ServiceCallEventSchema.safeParse({
        event: 'service_call',
        service: this.service,
        env: this.env,
        ...input,
      })

      if (!parsed.success) {
        // Emit a warning so bad payloads don't break prod dashboards
        this.warn('provider_call_invalid', {
          issues: parsed.error.format(),
          raw: input,
        })
        return
      }

      // Single consistent JSON for Loki
      this.info('provider_call', parsed.data)
    } catch {
      // Fail silently - service call logging should never break the app
    }
  }
}

// ---------------------------------------------------------------------------
// ScopedLogger — isolated context, delegates to parent's Winston instance
// ---------------------------------------------------------------------------

/**
 * Lightweight logger with a fixed context string.
 *
 * Never reads AsyncContextStorage, never mutates the parent.
 * Implements the same public API surface as LoggerService so call sites
 * can accept either type.
 */
export class ScopedLogger {
  constructor(
    private readonly parent: LoggerService,
    private readonly childContext: string,
  ) {}

  /** No-op — child context is immutable. Provided for interface compat. */
  setContext(_context: string): void {
    // Intentionally ignored — child context is fixed at creation time
  }

  private withContext(meta?: Record<string, unknown>): Record<string, unknown> {
    return { context: this.childContext, ...meta }
  }

  private withEnvelope(tier: LogTier, meta?: Record<string, unknown>): Record<string, unknown> {
    const { channel, event, ...rest } = meta ?? {}
    const requestId = this.getRequestId()
    return this.withContext({
      schema: LOG_SCHEMA_VERSION,
      serviceVersion: this.parent._serviceVersion,
      env: this.parent._env,
      tier,
      channel: (channel as LogChannel) ?? TIER_CHANNEL[tier],
      event: (event as string) ?? 'log',
      ...(requestId && { requestId }),
      ...rest,
    })
  }

  private getRequestId(): string | undefined {
    try {
      return AsyncContextStorage.getStore()?.correlationId
    } catch {
      return undefined
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.info(message, this.withContext(meta))
      } else {
        console.log(`[INFO] ${message}`, meta || '')
      }
    } catch { /* fail silently */ }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.error(message, this.withContext(meta))
      } else {
        console.error(`[ERROR] ${message}`, meta || '')
      }
    } catch { /* fail silently */ }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.warn(message, this.withContext(meta))
      } else {
        console.warn(`[WARN] ${message}`, meta || '')
      }
    } catch { /* fail silently */ }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.debug(message, this.withContext(meta))
      } else {
        if (this.parent._env === 'dev' || this.parent._env === 'local') {
          console.debug(`[DEBUG] ${message}`, meta || '')
        }
      }
    } catch { /* fail silently */ }
  }

  critical(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.error(message, this.withEnvelope(LogTier.CRITICAL, meta))
      } else {
        console.error(`[CRITICAL] ${message}`, meta || '')
      }
    } catch { /* fail silently */ }
  }

  operational(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.info(message, this.withEnvelope(LogTier.OPERATIONAL, meta))
      } else {
        console.log(`[OPERATIONAL] ${message}`, meta || '')
      }
    } catch { /* fail silently */ }
  }

  lifecycle(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.info(message, this.withEnvelope(LogTier.LIFECYCLE, meta))
      } else {
        console.log(`[LIFECYCLE] ${message}`, meta || '')
      }
    } catch { /* fail silently */ }
  }

  debugTiered(message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.parent._winston && this.parent._initialized) {
        this.parent._winston.debug(message, this.withEnvelope(LogTier.DEBUG, meta))
      } else {
        if (this.parent._env === 'dev' || this.parent._env === 'local') {
          console.debug(`[DEBUG] ${message}`, meta || '')
        }
      }
    } catch { /* fail silently */ }
  }
}
