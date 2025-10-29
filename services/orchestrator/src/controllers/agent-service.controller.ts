// services/orchestrator/src/controllers/agent-service.controller.ts
import { 
  Controller, 
  All, 
  Req, 
  Res, 
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { AgentServiceClientFactory } from '../clients/agent-service/agent-service.factory.js'
import { LoggerService } from '../core/logger.service.js'
import { isAxiosError } from 'axios'
import { ProblemTypes, ProblemTitles } from '@exprealty/shared-domain'

/**
 * Agent Service Controller
 * 
 * Catch-all proxy that forwards ALL requests under /v1/agent/* 
 * to the agent-service microservice.
 * 
 * This is a pure pass-through proxy:
 * 1. Receive request at /v1/agent/*
 * 2. Get client from factory (no tenant ID needed)
 * 3. Proxy request to agent-service
 * 4. Return response
 */
@Controller('/v1/agent')
export class AgentServiceController {
  constructor(
    private readonly agentFactory: AgentServiceClientFactory,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Catch-all route handler
   * 
   * Matches ANY HTTP method and ANY path under /v1/agent/*
   * 
   * Examples:
   * - POST /v1/agent/chat → agent-service:8090/v1/agent/chat
   * - GET /v1/agent/sessions → agent-service:8090/v1/agent/sessions
   * - PUT /v1/agent/sessions/123 → agent-service:8090/v1/agent/sessions/123
   * - DELETE /v1/agent/messages/456 → agent-service:8090/v1/agent/messages/456
   */
  @All('*')
  async proxyToAgentService(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const startTime = Date.now()
    const method = req.method
    const path = req.path
    const body = req.body
    const query = req.query
    const headers = req.headers

    try {
      this.logger.info('Agent service request', {
        method,
        path,
        hasBody: !!body && Object.keys(body).length > 0,
        query,
      })

      // ═══════════════════════════════════════════════════════════
      // FACTORY PATTERN - SIMPLIFIED
      // ═══════════════════════════════════════════════════════════
      // 
      // Just ask: "Give me a client"
      // No tenant ID, no provider selection - just get the client.
      //
      const client = this.agentFactory.get()

      // Proxy the request
      const response = await client.proxy({
        method: method as any,
        path,
        body,
        query,
        headers: {
          // Forward important headers
          'content-type': headers['content-type'],
          'accept': headers['accept'],
          'user-agent': headers['user-agent'],
          'authorization': headers['authorization'],  // Forward auth if present
        },
      })

      const duration = Date.now() - startTime

      this.logger.info('Agent service request succeeded', {
        method,
        path,
        status: response.status,
        duration_ms: duration,
      })

      // Set response status
      res.status(response.status)
      
      // Forward response headers
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value as string)
          }
        })
      }

      // Send response body
      res.json(response.data)

    } catch (error) {
      const duration = Date.now() - startTime

      this.logger.error('Agent service request failed', {
        method,
        path,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Handle Axios errors
      if (isAxiosError(error)) {
        const status = error.response?.status || HttpStatus.BAD_GATEWAY
        const data = error.response?.data || {
          type: ProblemTypes.Upstream,
          title: ProblemTitles[ProblemTypes.Upstream],
          status,
          detail: error.message || 'Failed to communicate with agent service',
          instance: path,
        }

        res.status(status).json(data)
        return
      }

      // Handle other errors
      const status = HttpStatus.INTERNAL_SERVER_ERROR
      res.status(status).json({
        type: ProblemTypes.Internal,
        title: ProblemTitles[ProblemTypes.Internal],
        status,
        detail: error instanceof Error ? error.message : 'An unexpected error occurred',
        instance: path,
      })
    }
  }

  /**
   * Health check endpoint
   * GET /v1/agent/health
   */
  @All('health')
  async health(): Promise<{ status: string; service: string }> {
    return {
      status: 'ok',
      service: 'agent-service-proxy',
    }
  }
}