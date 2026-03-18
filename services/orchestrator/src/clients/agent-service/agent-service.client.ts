// services/orchestrator/src/clients/agent-service/agent-service.client.ts

/**
 * Agent Service Client Interface
 * 
 * Defines the contract for communicating with the agent-service microservice.
 * Implementations can be REST, gRPC, or other protocols.
 */
export interface AgentServiceClient {
  /**
   * Proxy a request to the agent service
   * 
   * @param request - The request to proxy
   * @returns The response from the agent service
   */
  proxy(request: ProxyRequest): Promise<ProxyResponse>

  /**
   * Health check for agent service
   * 
   * @returns Health status
   */
  health(): Promise<{ status: string }>
}

/**
 * Request to proxy to agent service
 */
export interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  path: string
  body?: any
  query?: Record<string, any>
  headers?: Record<string, string>
}

/**
 * Response from agent service
 */
export interface ProxyResponse {
  status: number
  data: any
  headers?: Record<string, string>
}