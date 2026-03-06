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
 * Catch-all proxy that forwards ALL requests under /v1/* 
 * to the agent-service microservice.
 * 
 * This is a pure pass-through proxy:
 * 1. Receive request at /v1/*
 * 2. Get client from factory (no tenant ID needed)
 * 3. Proxy request to agent-service
 * 4. Return response
 */
@Controller('/v1')
export class AgentServiceController {
  constructor(
    private readonly agentFactory: AgentServiceClientFactory,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Catch-all route handler
   * 
   * Matches ANY HTTP method and ANY path under /v1/*
   * 
   * Examples:
   * - POST /v1/countries → agent-service:3000/v1/countries
   * - GET /v1/agent/health → agent-service:3000/v1/agent/health
   * - PUT /v1/countries/US → agent-service:3000/v1/countries/US
   * - DELETE /v1/countries/CA → agent-service:3000/v1/countries/CA
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
      // TEMPORARY DEBUG: Log all headers to see what API Gateway is sending
      const allHeaders: Record<string, string | string[] | undefined> = {};
      Object.keys(headers).forEach((key) => {
        allHeaders[key.toLowerCase()] = headers[key];
      });
      this.logger.info('API Gateway request headers (for debugging)', {
        method,
        path,
        headers: allHeaders,
        hasAuthorization: !!headers['authorization'],
        authorizationPrefix: headers['authorization'] ? (Array.isArray(headers['authorization']) ? headers['authorization'][0] : headers['authorization']).substring(0, 30) : 'none',
      });

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

      // Proxy the request - Forward headers to preserve API Gateway context, but NOT body framing headers.
      // We send req.body (parsed by Express) re-serialized by Axios; the byte length can differ from the
      // client's original body (key order, normalization). If we forward the client's content-length,
      // the downstream expects that many bytes and waits for them → request aborted when connection closes.
      const forwardedHeaders: Record<string, string> = {};
      const skipRequestFraming = ['content-length', 'transfer-encoding'];

      Object.keys(headers).forEach((key) => {
        const lower = key.toLowerCase();
        if (skipRequestFraming.includes(lower)) {
          return;
        }
        const value = headers[key];
        if (value) {
          forwardedHeaders[lower] = Array.isArray(value) ? value[0] : value;
        }
      });

      // Ensure proxy headers are set
      forwardedHeaders['x-forwarded-host'] = forwardedHeaders['x-forwarded-host'] || (Array.isArray(headers.host) ? headers.host[0] : headers.host) || '';
      forwardedHeaders['x-forwarded-proto'] = forwardedHeaders['x-forwarded-proto'] || req.protocol;

      const response = await client.proxy({
        method: method as any,
        path,
        body,
        query,
        headers: forwardedHeaders,
      })

      const duration = Date.now() - startTime

      this.logger.info('Agent service request succeeded', {
        method,
        path,
        status: response.status,
        duration_ms: duration,
      })

      // CRITICAL: Normalize response headers before forwarding
      // Since axios buffers the entire response (responseType: 'json'),
      // we are NOT streaming. Therefore:
      // - Remove Transfer-Encoding (we're not chunking)
      // - Remove Content-Length (Express will set it correctly based on serialized JSON)
      // This ensures only ONE framing mechanism is used
      const normalizedHeaders: Record<string, string> = {}
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          if (value === undefined) {
            return
          }
          
          const lowerKey = key.toLowerCase()
          
          // Skip framing headers - Express will set them correctly
          if (lowerKey === 'transfer-encoding' || lowerKey === 'content-length') {
            this.logger.debug('[RESPONSE_FRAMING] Skipping framing header from upstream', {
              method,
              path,
              header: key,
              value: String(value),
              reason: 'Express will set framing headers based on response body',
            })
            return
          }
          
          // Forward all other headers
          normalizedHeaders[key] = String(value)
        })
      }

      // Diagnostic logging: Log headers before setting them
      this.logger.info('[RESPONSE_FRAMING] Normalized response headers', {
        method,
        path,
        status: response.status,
        upstreamHeaders: response.headers ? Object.keys(response.headers) : [],
        normalizedHeaders: Object.keys(normalizedHeaders),
        hasTransferEncoding: response.headers?.['transfer-encoding'] || response.headers?.['Transfer-Encoding'],
        hasContentLength: response.headers?.['content-length'] || response.headers?.['Content-Length'],
        responseDataSize: response.data ? JSON.stringify(response.data).length : 0,
      })

      // Set response status
      res.status(response.status)
      
      // Forward normalized headers (excluding framing headers)
      Object.entries(normalizedHeaders).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

      // Diagnostic logging: Log headers at write time
      const headersBeforeWrite = {
        transferEncoding: res.getHeader('transfer-encoding'),
        contentLength: res.getHeader('content-length'),
        headersSent: res.headersSent,
        finished: (res as any).finished,
      }
      
      this.logger.info('[RESPONSE_FRAMING] Headers before res.json()', {
        method,
        path,
        ...headersBeforeWrite,
      })

      // Send response body
      // Express will automatically set Content-Length based on serialized JSON size
      res.json(response.data)

      // Diagnostic logging: Log headers after write
      // Note: headersSent will be true after res.json() if headers were committed
      const headersAfterWrite = {
        headersSent: res.headersSent,
        finished: (res as any).finished,
      }
      
      this.logger.info('[RESPONSE_FRAMING] Headers after res.json()', {
        method,
        path,
        ...headersAfterWrite,
      })

    } catch (error) {
      const duration = Date.now() - startTime
      const axiosErr = isAxiosError(error) ? error : null
      const upstreamProblem = axiosErr ? (axiosErr as { upstreamProblem?: { status: number; type?: string; [k: string]: unknown } }).upstreamProblem : undefined
      const resolvedStatus = upstreamProblem?.status ?? axiosErr?.response?.status ?? HttpStatus.BAD_GATEWAY

      const requestId = (headers['x-request-id'] as string) || (Array.isArray(headers['x-request-id']) ? headers['x-request-id'][0] : undefined)
      const correlationId = (headers['x-correlation-id'] as string) || (Array.isArray(headers['x-correlation-id']) ? headers['x-correlation-id'][0] : undefined)
      this.logger.error('Agent service request failed', {
        method,
        path,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error_code: axiosErr?.code,
        resolved_status: resolvedStatus,
        is_upstream_timeout: axiosErr?.code === 'ECONNABORTED' || resolvedStatus === 504,
        upstream_problem_type: upstreamProblem?.type,
        upstream_returned_response: !!axiosErr?.response,
        request_id: requestId,
        correlation_id: correlationId,
      })

      // Handle Axios errors: use upstreamProblem when present (e.g. 504 for ECONNABORTED)
      if (axiosErr) {
        const status = resolvedStatus
        const data = upstreamProblem ?? axiosErr.response?.data ?? {
          type: ProblemTypes.Upstream,
          title: ProblemTitles[ProblemTypes.Upstream],
          status,
          detail: axiosErr.message || 'Failed to communicate with agent service',
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
   * Agent service health check endpoint
   * GET /v1/agent/health → forwards to agent-service
   * 
   * Note: /v1/health is handled by OrchestratorController and returns orchestrator health.
   * This route specifically checks agent-service health by proxying the request.
   */
  @All('agent/health')
  async agentHealth(): Promise<{ status: string; service: string }> {
    return {
      status: 'ok',
      service: 'agent-service-proxy',
    }
  }
}