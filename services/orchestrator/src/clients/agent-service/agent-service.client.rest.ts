// services/orchestrator/src/clients/agent-service/agent-service.client.rest.ts
import type { 
  AgentServiceClient, 
  ProxyRequest, 
  ProxyResponse 
} from './agent-service.client.js'
import { EcsHttpClient } from '../../common/ecs-http-client.js'
import type { LoggerService } from '../../core/logger.service.js'

/**
 * REST implementation of Agent Service Client
 * 
 * Uses EcsHttpClient for internal service communication via ECS Service Connect.
 * This client handles all HTTP communication with the agent-service microservice.
 * 
 * Key features:
 * - Automatic request/response logging
 * - Metrics recording
 * - Error handling with Problem Details
 * - S2S authentication
 * - Timeout management (60s for long-running agent operations)
 */
export class AgentServiceRestClient implements AgentServiceClient {
  private readonly http: EcsHttpClient
  private readonly logger: LoggerService

  constructor(
    baseUrl: string,          // e.g., http://agent-service:8090
    logger: LoggerService,
    s2sKey?: string,
  ) {
    this.logger = logger
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (s2sKey) {
      headers['x-internal-auth'] = s2sKey
    }

    // Create EcsHttpClient for internal service communication
    this.http = new EcsHttpClient(
      logger,
      { 
        service: 'agent-service',  // ServiceCtx - identifies the target service
      },
      {
        baseURL: baseUrl,
        timeout: 60_000,  // 60s timeout for agent operations (can be long-running)
        headers,
      },
    )
  }

  /**
   * Proxy a request to the agent service
   * 
   * This method forwards any HTTP request to the agent service,
   * preserving method, path, body, query params, and headers.
   * 
   * @param request - The request to proxy
   * @returns The response from agent service
   */
  async proxy(request: ProxyRequest): Promise<ProxyResponse> {
    const { method, path, body, query, headers } = request
    const startTime = Date.now()

    // Build Axios request config
    // Explicitly set responseType to 'json' to ensure proper response handling
    const config = {
      method,
      url: path,
      data: body,
      params: query,
      headers,
      responseType: 'json' as const,  // Explicit JSON response type
      maxContentLength: Infinity,      // Allow large responses
      maxBodyLength: Infinity,         // Allow large request bodies
      validateStatus: () => true,      // Don't throw on any status code - handle in catch
    }

    try {
      this.logger.info('[PROXY_DEBUG] Starting proxy request', {
        method,
        path,
        hasBody: !!body,
        bodySize: body ? JSON.stringify(body).length : 0,
        queryKeys: query ? Object.keys(query) : [],
        headerKeys: headers ? Object.keys(headers) : [],
        timestamp: startTime,
      })

      // Execute request via EcsHttpClient
      // This automatically:
      // - Adds x-request-id, x-service-id headers
      // - Records metrics
      // - Logs the request/response
      const requestPromise = this.http.instance.request(config)
      
      this.logger.info('[PROXY_DEBUG] Axios request promise created, awaiting response', {
        method,
        path,
        timestamp: Date.now(),
      })

      const response = await requestPromise
      const duration = Date.now() - startTime

      this.logger.info('[PROXY_DEBUG] Axios response received', {
        method,
        path,
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataSize: response.data ? JSON.stringify(response.data).length : 0,
        headerCount: Object.keys(response.headers).length,
        duration_ms: duration,
        timestamp: Date.now(),
      })

      const result = {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      }

      this.logger.info('[PROXY_DEBUG] Proxy response constructed, returning', {
        method,
        path,
        status: result.status,
        timestamp: Date.now(),
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      this.logger.error('[PROXY_DEBUG] Proxy request failed', {
        method,
        path,
        duration_ms: duration,
        error_type: error?.constructor?.name,
        error_code: error?.code,
        error_message: error?.message,
        has_response: !!error?.response,
        response_status: error?.response?.status,
        response_data_type: typeof error?.response?.data,
        timestamp: Date.now(),
      })

      // If we have a response, return it (even if error status)
      if (error.response) {
        this.logger.info('[PROXY_DEBUG] Returning error response', {
          method,
          path,
          status: error.response.status,
          timestamp: Date.now(),
        })
        
        return {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        }
      }
      
      // Re-throw if no response (network error, timeout, etc.)
      this.logger.error('[PROXY_DEBUG] Re-throwing error (no response)', {
        method,
        path,
        error_code: error?.code,
        error_message: error?.message,
        timestamp: Date.now(),
      })
      
      throw error
    }
  }

  /**
   * Health check for agent service
   * 
   * @returns Health status
   */
  async health(): Promise<{ status: string }> {
    return this.http.get<{ status: string }>('/health')
  }
}