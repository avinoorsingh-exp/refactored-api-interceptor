// services/orchestrator/src/common/ecs-http-client.ts
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  isAxiosError,
} from 'axios'
import { v4 as uuid } from 'uuid'
import { LoggerService } from '../core/logger.service.js'
import { 
  Capability, 
  ProblemTypes, 
  isProblemDetails, 
  type UpstreamProblemDetails 
} from '@exprealty/shared-domain'
import { normalizeEndpoint } from './endpoint.js'
import { setHeaders } from './headers.js'
import { CorrelationIdHelper } from '@exprealty/cache'

// ---------------------------------------------------------------------------
// Error and types
// ---------------------------------------------------------------------------

export class UpstreamHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem: UpstreamProblemDetails,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'UpstreamHttpError'
  }
}

/**
 * Context for internal service-to-service communication
 * Used for orchestrator → microservices within ECS Service Connect
 */
export interface ServiceCtx {
  service: string        // e.g., "agent-service", "notification-service"
  capability?: Capability
}

export interface EcsHttpClientOptions extends AxiosRequestConfig {
  baseURL?: string
  timeout?: number
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestMeta {
  t0: number
  rid: string
  retries: number
}

const metaMap = new WeakMap<AxiosRequestConfig, RequestMeta>()

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function resolveStatus(err: AxiosError): number {
  if (err.response?.status) return err.response.status
  if (err.code === 'ECONNABORTED') return 504
  if (['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'].includes(err.code ?? '')) return 503 // Service unavailable
  return 502
}

function mapErrorToProblem(
  err: AxiosError, 
  instance: string, 
  traceId?: string
): UpstreamProblemDetails {
  const status = resolveStatus(err)
  const isTimeout = err.code === 'ECONNABORTED'
  const isServiceUnavailable = ['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'].includes(err.code ?? '')
  
  const type = isTimeout
    ? ProblemTypes.Timeout
    : isServiceUnavailable
    ? ProblemTypes.ServiceUnavailable
    : status === 502
    ? ProblemTypes.BadGateway
    : ProblemTypes.Upstream

  const upstreamPD = err.response?.data
  const detail =
    isProblemDetails(upstreamPD) && typeof upstreamPD.detail === 'string'
      ? upstreamPD.detail
      : err.message || 'Failed calling internal service'

  return {
    type,
    title:
      status === 502
        ? 'Bad Gateway'
        : status === 503
        ? 'Service Unavailable'
        : status === 504
        ? 'Gateway Timeout'
        : 'Internal Service Error',
    status,
    detail,
    instance,
    traceId,
    upstream: {
      code: err.code,
      url: err.config?.url,
      method: err.config?.method?.toUpperCase(),
      providerStatus: err.response?.status ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// EcsHttpClient - For Internal Service Communication
// ---------------------------------------------------------------------------

/**
 * HTTP client for internal service-to-service communication within ECS.
 * 
 * Use this for:
 * - Orchestrator → address-provider
 * - Orchestrator → property-provider
 * - Any microservice → another microservice
 * 
 * Do NOT use this for external provider APIs (Smarty, BatchData, etc.)
 * For external APIs, use HttpClient instead.
 */
export class EcsHttpClient {
  private readonly client: AxiosInstance

  constructor(
    private readonly logger: LoggerService,
    private readonly ctx: ServiceCtx,
    opts: EcsHttpClientOptions = {},
  ) {
    const { baseURL, timeout = 30_000, ...rest } = opts

    this.client = axios.create({
      baseURL,
      timeout,
      ...rest,
    })

    this.registerInterceptors()
  }

  private registerInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use((config) => {
      const rid = uuid()
      metaMap.set(config, { t0: Date.now(), rid, retries: 0 })

      // Get correlation ID from AsyncLocalStorage or generate new one
      const correlationId = CorrelationIdHelper.getOrGenerateCorrelationId()

      setHeaders(config, {
        'x-request-id': rid,
        'x-correlation-id': correlationId,     // Propagate correlation ID
        'x-service-id': this.ctx.service,      // Internal service identifier
        'x-source-service': 'orchestrator',    // Who's calling
        ...(this.ctx.capability ? { 'x-capability': this.ctx.capability } : {}),
      })

      return config
    })

    // Response interceptors (success + error)
    this.client.interceptors.response.use(
      (res) => this.handleSuccess(res),
      (err) => this.handleFailure(err),
    )
  }

  // -------------------------------------------------------------------------
  // Response Handlers
  // -------------------------------------------------------------------------

  private handleSuccess(res: AxiosResponse): AxiosResponse {
    const meta = metaMap.get(res.config)
    const rid = meta?.rid
    const duration_ms = Date.now() - (meta?.t0 ?? Date.now())
    const endpoint = normalizeEndpoint(res.config.url ?? '')
    const method = ((res.config.method ?? 'get').toUpperCase() || 'GET') as HttpMethod
    const status = res.status
    const ok = status >= 200 && status < 300

    // Log internal service call
    this.logger.info('Internal service call succeeded', {
      service: this.ctx.service,
      capability: this.ctx.capability,
      endpoint,
      method,
      status,
      duration_ms,
      request_id: rid,
      retries: meta?.retries ?? 0,
    })

    // Record metrics for internal service health
    this.logger.getMetrics().recordHttpRequest({
      method,
      route: endpoint,
      status,
      duration_ms,
    })

    return res
  }

  private handleFailure(unknownErr: unknown): Promise<never> {
    // Handle non-Axios errors
    if (!isAxiosError(unknownErr)) {
      const err = unknownErr instanceof Error ? unknownErr : new Error(String(unknownErr))
      const pd: UpstreamProblemDetails = {
        type: ProblemTypes.Upstream,
        title: 'Internal Service Error',
        status: 502,
        detail: err.message,
        instance: 'internal',
        traceId: undefined,
      }
      
      this.logger.error('Non-Axios error in internal service call', {
        error: err.message,
        stack: err.stack,
      })
      
      return Promise.reject(new UpstreamHttpError(pd.title, pd.status, pd, err))
    }

    const err = unknownErr as AxiosError
    const cfg = err.config
    const meta = cfg ? metaMap.get(cfg) : undefined
    const rid = meta?.rid
    const duration_ms = Date.now() - (meta?.t0 ?? Date.now())
    const endpoint = normalizeEndpoint(cfg?.url ?? '')
    const method = ((cfg?.method ?? 'get').toUpperCase() || 'GET') as HttpMethod
    const status = err.response?.status ?? 0

    // Log internal service call failure
    this.logger.error('Internal service call failed', {
      service: this.ctx.service,
      capability: this.ctx.capability,
      endpoint,
      method,
      status,
      duration_ms,
      request_id: rid,
      retries: meta?.retries ?? 0,
      error_code: err.code,
      error_message: err.message,
    })

    // Record error metrics
    this.logger.getMetrics().recordHttpRequest({
      method,
      route: endpoint,
      status: status || 502,
      duration_ms,
    })

    // Map to Problem Details
    const instance = cfg?.url ?? ''
    const pd = mapErrorToProblem(err, instance, rid)

    // Attach structured problem info to error
    Object.defineProperty(err, 'upstreamProblem', {
      value: pd,
      enumerable: true,
      writable: false,
    })
    Object.defineProperty(err, 'upstreamStatus', {
      value: pd.status,
      enumerable: true,
      writable: false,
    })

    return Promise.reject(err)
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  get instance(): AxiosInstance {
    return this.client
  }

  async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config)
    return response.data
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'GET' })
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, data, method: 'POST' })
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, data, method: 'PUT' })
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, data, method: 'PATCH' })
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'DELETE' })
  }
}