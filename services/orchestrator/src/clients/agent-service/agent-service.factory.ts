// services/orchestrator/src/clients/agent-service/agent-service.factory.ts
import { Injectable } from '@nestjs/common'
import type { AgentServiceClient } from './agent-service.client.js'
import { AgentServiceRestClient } from './agent-service.client.rest.js'
import { ConfigService } from '../../core/config.service.js'
import { LoggerService } from '../../core/logger.service.js'

type Transport = 'rest' | 'grpc'

/**
 * Agent Service Client Factory
 *
 * 
 * This factory creates clients for the agent-service microservice.
 * Since we don't have multi-tenancy, this is straightforward:
 * - Read configuration from environment
 * - Create client
 * - Return it
 * 
 * The Factory Pattern is still valuable because:
 * 1. Abstraction: Controllers don't create clients directly
 * 2. Transport flexibility: Easy to switch REST ↔ gRPC
 * 3. Centralized config: One place to manage client creation
 * 4. Testability: Easy to mock
 * 5. Future-proof: Can add features without changing controllers
 * 
 * Usage:
 * ```typescript
 * const client = this.agentFactory.get()
 * const response = await client.proxy({...})
 * ```
 */
@Injectable()
export class AgentServiceClientFactory {
  constructor(
    private readonly cfg: ConfigService,       // Application configuration
    private readonly logger: LoggerService,     // Logging & metrics
  ) {}

  /**
   * Get agent service client
   * 
   * No parameters needed - all config from environment.
   * 
   * @returns Configured AgentServiceClient
   */
  get(): AgentServiceClient {
    // Step 1: Get transport (REST or gRPC)
    const transport: Transport = this.cfg.get('AGENT_SERVICE_TRANSPORT')

    // Step 2: Get endpoint URL
    const endpoint = this.cfg.get('AGENT_SERVICE_URL')
    // e.g., 'http://agent-service:8090'

    // Step 3: Get S2S auth key
    const s2sKey = this.cfg.get('S2S_INTERNAL_KEY')

    // Step 4: Create client based on transport
    if (transport === 'grpc') {
      throw new Error('gRPC transport not implemented yet for agent service')
    }

    // Step 5: Return REST client
    return new AgentServiceRestClient(endpoint, this.logger, s2sKey)
  }

  /**
   * Get client with custom configuration (for testing)
   */
  getWithConfig(overrides: {
    endpoint?: string
    transport?: Transport
    s2sKey?: string
  }): AgentServiceClient {
    const transport = overrides.transport || this.cfg.get('AGENT_SERVICE_TRANSPORT')
    const endpoint = overrides.endpoint || this.cfg.get('AGENT_SERVICE_URL')
    const s2sKey = overrides.s2sKey || this.cfg.get('S2S_INTERNAL_KEY')

    if (transport === 'grpc') {
      throw new Error('gRPC transport not implemented yet')
    }

    return new AgentServiceRestClient(endpoint, this.logger, s2sKey)
  }
}