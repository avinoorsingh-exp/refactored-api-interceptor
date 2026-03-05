// services/orchestrator/src/controllers/swagger-proxy.controller.ts
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

/**
 * Swagger Proxy Controller
 * 
 * Proxies /api/* requests to agent-service's Swagger documentation.
 * This allows accessing the full API documentation through the orchestrator.
 */
@Controller()
export class SwaggerProxyController {
  constructor(
    private readonly agentFactory: AgentServiceClientFactory,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Proxy all /api/* requests to agent-service's Swagger
   */
  @All('/api*')
  async proxySwagger(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const client = this.agentFactory.get()
      
      // req.path already contains /api from the route match
      // Just use it directly without adding /api prefix
      const path = req.path
      
      this.logger.debug('Swagger proxy request', { 
        originalUrl: req.url,
        path,
        method: req.method 
      })
      
      // Forward the request using the proxy method
      const response = await client.proxy({
        method: req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path,
        query: req.query as Record<string, string>,
        headers: req.headers as Record<string, string>,
        body: req.body,
      })

      // Copy response headers
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value)
        })
      }

      // Send response
      res.status(response.status).send(response.data)
    } catch (error) {
      if (isAxiosError(error)) {
        this.logger.error('Swagger proxy error', {
          path: req.path,
          error: error.message,
          status: error.response?.status,
        })

        res.status(error.response?.status || HttpStatus.BAD_GATEWAY).json({
          type: 'https://httpstatuses.io/502',
          title: 'Bad Gateway',
          status: HttpStatus.BAD_GATEWAY,
          detail: 'Failed to proxy Swagger documentation from agent-service',
        })
      } else {
        this.logger.error('Unexpected swagger proxy error', { 
          path: req.path,
          error: error instanceof Error ? error.message : 'Unknown error' 
        })

        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          type: 'https://httpstatuses.io/500',
          title: 'Internal Server Error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail: 'An unexpected error occurred while proxying Swagger documentation',
        })
      }
    }
  }
}
