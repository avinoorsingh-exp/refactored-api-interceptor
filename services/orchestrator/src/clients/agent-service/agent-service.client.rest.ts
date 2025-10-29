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

  constructor(
    baseUrl: string,          // e.g., http://agent-service:8090
    logger: LoggerService,
    s2sKey?: string,
  ) {
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

    // Build Axios request config
    const config = {
      method,
      url: path,
      data: body,
      params: query,
      headers,
    }

    try {
      // Execute request via EcsHttpClient
      // This automatically:
      // - Adds x-request-id, x-service-id headers
      // - Records metrics
      // - Logs the request/response
      const response = await this.http.instance.request(config)

      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      }
    } catch (error: any) {
      // If we have a response, return it (even if error status)
      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        }
      }
      
      // Re-throw if no response (network error, timeout, etc.)
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