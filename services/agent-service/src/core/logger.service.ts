// services/orchestrator/src/core/logger.service.ts
import { Injectable } from '@nestjs/common'
import { createLogger, type Logger as WinstonLogger } from '@exprealty/logger'
import { MetricsService } from '@exprealty/logger/metrics'
import { z } from 'zod'

import {
  ServiceCallEventSchema,
  type ServiceCallEvent,
  EnvEnum,
} from '@exprealty/shared-domain'

import { ConfigService } from './config.service.js'

@Injectable()
export class LoggerService {
  private readonly logger: WinstonLogger
  private readonly metrics: MetricsService
  // NOTE: this was incorrectly copied from the orchestrator service.
  // Ensure the logger reports the correct service name for containerized logs.
  private readonly service = 'agent-service'
  private readonly env: z.infer<typeof EnvEnum>

  constructor(private readonly configService: ConfigService) {
    this.env = this.configService.get('NODE_ENV') || 'dev'

    this.logger = createLogger({
      service: this.service,
      level: this.configService.get('LOG_LEVEL') || 'info',
      logDir: this.configService.get('LOG_DIR'),
      env: this.env,
    })

    const headersJson = this.configService.get('METRICS_EXPORTER_HEADERS')
    let exporterHeaders: Record<string, string> = {}
    if (headersJson) {
      try {
        exporterHeaders = JSON.parse(headersJson)
      } catch (err) {
        this.logger.warn('Failed to parse METRICS_EXPORTER_HEADERS', { error: err })
      }
    }

    // Initialize OTEL metrics
    this.metrics = new MetricsService({
      service: this.service,
      version: '0.1.0',
      env: this.env,
      exporterEndpoint: this.configService.get('METRICS_EXPORTER_ENDPOINT'),
      exporterProtocol: this.configService.get('METRICS_EXPORTER_PROTOCOL'),
      exportIntervalMillis: this.configService.get('METRICS_EXPORT_INTERVAL_MS'),
      exporterHeaders,
      enableDiagnostics: this.configService.get('METRICS_ENABLE_DIAGNOSTICS'),
      diagnosticsVerbose: this.configService.get('METRICS_DIAGNOSTICS_VERBOSE'),
    })
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, meta)
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.logger.error(message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, meta)
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(message, meta)
  }

    // -------------------------------------------------------------------------
  // Metrics Access
  // -------------------------------------------------------------------------

  /**
   * Get the metrics service instance
   * Used by HTTP clients and interceptors to record metrics
   */
  getMetrics(): MetricsService {
    return this.metrics
  }

  serviceCall(input: Omit<ServiceCallEvent, 'event' | 'service' | 'env'>) {
    const parsed = ServiceCallEventSchema.safeParse({
      event: 'service_call',
      service: this.service,
      env: this.env,
      ...input,
    })

    if (!parsed.success) {
      // Emit a warning so bad payloads don’t break prod dashboards
      this.logger.warn('provider_call_invalid', {
        issues: parsed.error.format(),
        raw: input,
      })
      return
    }

    // Single consistent JSON for Loki
    this.logger.info('provider_call', parsed.data)
  }
}
