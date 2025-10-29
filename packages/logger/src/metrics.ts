// packages/logger/src/metrics.ts
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter as OTLPMetricExporterHTTP } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPMetricExporter as OTLPMetricExporterGRPC } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { metrics, Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api'

export type ExporterProtocol = 'http' | 'grpc'

export interface MetricsOptions {
  service: string
  version?: string
  env?: 'development' | 'test' | 'production'
  
  // Generic exporter configuration
  exporterEndpoint?: string          // e.g., 'http://localhost:4318' or 'grpc://localhost:4317'
  exporterProtocol?: ExporterProtocol // 'http' | 'grpc'
  exportIntervalMillis?: number
  exporterHeaders?: Record<string, string>  // For auth, API keys, etc.
  
  // Diagnostics
  enableDiagnostics?: boolean        // Enable console/debug export
  diagnosticsVerbose?: boolean       // Detailed diagnostic logging
}

export class MetricsService {
  private meter: Meter
  private enabled: boolean
  
  // HTTP Metrics
  public readonly httpRequestsTotal: Counter
  public readonly httpRequestDuration: Histogram
  public readonly httpRequestsInFlight: UpDownCounter
  
  // Validation Metrics
  public readonly validationErrorsTotal: Counter
  
  // Provider Metrics
  public readonly providerCallsTotal: Counter
  public readonly providerCallDuration: Histogram
  public readonly providerCallCost: Counter
  
  // Idempotency Metrics
  public readonly idempotencyHitsTotal: Counter
  public readonly idempotencyMissesTotal: Counter

  constructor(options: MetricsOptions) {
    const {
      service,
      version = '0.1.0',
      env = 'development',
      exporterEndpoint,
      exporterProtocol = 'http',
      exportIntervalMillis = 10000,
      exporterHeaders = {},
      enableDiagnostics = false,
      diagnosticsVerbose = false,
    } = options

    // Determine if metrics are enabled
    this.enabled = Boolean(exporterEndpoint || enableDiagnostics)

    if (!this.enabled) {
      console.log('[Metrics] No exporter endpoint configured, metrics disabled')
      // Create no-op meter
      this.meter = metrics.getMeter('noop')
      this.httpRequestsTotal = this.meter.createCounter('noop')
      this.httpRequestDuration = this.meter.createHistogram('noop')
      this.httpRequestsInFlight = this.meter.createUpDownCounter('noop')
      this.validationErrorsTotal = this.meter.createCounter('noop')
      this.providerCallsTotal = this.meter.createCounter('noop')
      this.providerCallDuration = this.meter.createHistogram('noop')
      this.providerCallCost = this.meter.createCounter('noop')
      this.idempotencyHitsTotal = this.meter.createCounter('noop')
      this.idempotencyMissesTotal = this.meter.createCounter('noop')
      return
    }

    // Create resource with service metadata
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: service,
      [ATTR_SERVICE_VERSION]: version,
      'environment': env,
      'service.namespace': 'exprealty',
    })

    // Configure metric readers
    const readers: any[] = []

    // Main exporter (OTLP)
    if (exporterEndpoint) {
      let exporter: any

      if (exporterProtocol === 'grpc') {
        exporter = new OTLPMetricExporterGRPC({
          url: exporterEndpoint,
          headers: exporterHeaders,
        })
      } else {
        // HTTP/Protobuf
        exporter = new OTLPMetricExporterHTTP({
          url: exporterEndpoint,
          headers: exporterHeaders,
        })
      }

      readers.push(
        new PeriodicExportingMetricReader({
          exporter,
          exportIntervalMillis,
        })
      )

      console.log(`[Metrics] Exporter configured: ${exporterProtocol}://${exporterEndpoint}`)
    }

    // Diagnostics exporter (console output for debugging)
    if (enableDiagnostics) {
      const consoleExporter = new ConsoleMetricExporter()
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: consoleExporter,
          exportIntervalMillis: diagnosticsVerbose ? 5000 : 30000, // More frequent if verbose
        })
      )
      console.log('[Metrics] Diagnostics enabled - metrics will be logged to console')
    }

    // Create MeterProvider
    const meterProvider = new MeterProvider({
      resource,
      readers,
    })

    // Set global meter provider
    metrics.setGlobalMeterProvider(meterProvider)

    // Get meter for this service
    this.meter = metrics.getMeter(service, version)

    console.log(`[Metrics] Initialized for service: ${service} (env: ${env})`)

    // ===== Initialize Metrics =====
    
    // HTTP Request Metrics
    this.httpRequestsTotal = this.meter.createCounter('http.server.requests', {
      description: 'Total HTTP requests',
      unit: '{request}',
    })

    this.httpRequestDuration = this.meter.createHistogram('http.server.request.duration', {
      description: 'HTTP request latency',
      unit: 'ms',
      advice: {
        explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      },
    })

    this.httpRequestsInFlight = this.meter.createUpDownCounter('http.server.active_requests', {
      description: 'HTTP requests currently being processed',
      unit: '{request}',
    })

    // Validation Error Metrics
    this.validationErrorsTotal = this.meter.createCounter('app.validation.errors', {
      description: 'Total validation errors',
      unit: '{error}',
    })

    // Provider Call Metrics
    this.providerCallsTotal = this.meter.createCounter('app.provider.calls', {
      description: 'Total provider API calls',
      unit: '{call}',
    })

    this.providerCallDuration = this.meter.createHistogram('app.provider.call.duration', {
      description: 'Provider call latency',
      unit: 'ms',
      advice: {
        explicitBucketBoundaries: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      },
    })

    this.providerCallCost = this.meter.createCounter('app.provider.call.cost', {
      description: 'Total provider API cost',
      unit: 'USD',
    })

    // Idempotency Metrics
    this.idempotencyHitsTotal = this.meter.createCounter('app.idempotency.hits', {
      description: 'Total idempotency cache hits',
      unit: '{hit}',
    })

    this.idempotencyMissesTotal = this.meter.createCounter('app.idempotency.misses', {
      description: 'Total idempotency cache misses',
      unit: '{miss}',
    })
  }

  /**
   * Check if metrics are enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Record an HTTP request
   */
  recordHttpRequest(attributes: {
    method: string
    route: string
    status: number
    duration_ms: number
  }) {
    if (!this.enabled) return

    const { method, route, status, duration_ms } = attributes
    
    const labels = {
      'http.request.method': method.toUpperCase(),
      'url.path': route,
      'http.response.status_code': status,
    }

    this.httpRequestsTotal.add(1, labels)
    this.httpRequestDuration.record(duration_ms, labels)
  }

  /**
   * Record validation error
   */
  recordValidationError(attributes: {
    endpoint: string
    field?: string
    error_type: string
  }) {
    if (!this.enabled) return

    this.validationErrorsTotal.add(1, {
      'url.path': attributes.endpoint,
      'error.type': attributes.error_type,
      'validation.field': attributes.field || 'unknown',
    })
  }

  /**
   * Record provider call
   */
  recordProviderCall(attributes: {
    provider: string
    capability?: string
    endpoint: string
    method: string
    status: number
    ok: boolean
    duration_ms: number
    cost_usd: number
    retries: number
  }) {
    if (!this.enabled) return

    const { provider, capability, endpoint, method, status, ok, duration_ms, cost_usd, retries } = attributes

    const labels = {
      'provider.name': provider,
      'provider.capability': capability || 'unknown',
      'url.path': endpoint,
      'http.request.method': method.toUpperCase(),
      'http.response.status_code': status,
      'provider.call.success': ok.toString(),
    }

    this.providerCallsTotal.add(1, labels)
    this.providerCallDuration.record(duration_ms, labels)
    
    if (cost_usd > 0) {
      this.providerCallCost.add(cost_usd, labels)
    }

    if (retries > 0) {
      // Optional: track retries separately if needed
    }
  }

  /**
   * Record idempotency hit/miss
   */
  recordIdempotency(hit: boolean, attributes: {
    endpoint: string
    method: string
  }) {
    if (!this.enabled) return

    const labels = {
      'url.path': attributes.endpoint,
      'http.request.method': attributes.method,
    }

    if (hit) {
      this.idempotencyHitsTotal.add(1, labels)
    } else {
      this.idempotencyMissesTotal.add(1, labels)
    }
  }

  /**
   * Track in-flight requests
   */
  incrementInFlight(attributes: { method: string; route: string }) {
    if (!this.enabled) return
    
    this.httpRequestsInFlight.add(1, {
      'http.request.method': attributes.method,
      'url.path': attributes.route,
    })
  }

  decrementInFlight(attributes: { method: string; route: string }) {
    if (!this.enabled) return
    
    this.httpRequestsInFlight.add(-1, {
      'http.request.method': attributes.method,
      'url.path': attributes.route,
    })
  }
}