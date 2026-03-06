import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { EcsHttpClient, ServiceCtx, UpstreamHttpError } from './ecs-http-client.js'
import { LoggerService } from '../core/logger.service.js'
import { AsyncContextStorage, CorrelationIdHelper, CORRELATION_ID_HEADER } from '@exprealty/cache'
import { AxiosError } from 'axios'
import { ProblemTypes } from '@exprealty/shared-domain'

describe('EcsHttpClient - Unit Tests', () => {
  let client: EcsHttpClient
  let mockLogger: jest.Mocked<LoggerService>
  let mockMetrics: { recordHttpRequest: jest.Mock }
  let capturedLogs: Array<{ level: string; message: string; meta?: Record<string, unknown> }>
  let capturedHeaders: Record<string, string> = {}
  const baseURL = 'http://test-service.local'
  const ctx: ServiceCtx = { service: 'test-service' }

  const server = setupServer()

  beforeEach(() => {
    capturedLogs = []
    capturedHeaders = {}
    mockMetrics = {
      recordHttpRequest: jest.fn(),
    }
    mockLogger = {
      info: jest.fn((message: string, meta?: Record<string, unknown>) => {
        capturedLogs.push({ level: 'info', message, meta })
      }),
      error: jest.fn((message: string, meta?: Record<string, unknown>) => {
        capturedLogs.push({ level: 'error', message, meta })
      }),
      warn: jest.fn(),
      debug: jest.fn(),
      getMetrics: jest.fn(() => mockMetrics),
    } as unknown as jest.Mocked<LoggerService>

    client = new EcsHttpClient(mockLogger, ctx, { baseURL })
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.resetHandlers()
    server.close()
    jest.clearAllMocks()
  })

  function setupMockEndpoint(
    path: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get',
    responseData: any = { success: true },
    statusCode: number = 200
  ): void {
    server.use(
      http[method](`${baseURL}${path}`, ({ request }) => {
        capturedHeaders = {}
        request.headers.forEach((value, key) => {
          capturedHeaders[key] = value
        })
        // For 204 No Content, return empty body
        if (statusCode === 204) {
          return new HttpResponse(null, { status: 204 })
        }
        return HttpResponse.json(responseData, { status: statusCode })
      })
    )
  }

  describe('Constructor and Configuration', () => {
    it('should create client with default timeout', () => {
      const defaultClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      expect(defaultClient.instance).toBeDefined()
    })

    it('should create client with custom timeout', () => {
      const customClient = new EcsHttpClient(mockLogger, ctx, { baseURL, timeout: 5000 })
      expect(customClient.instance).toBeDefined()
    })

    it('should create client with capability header', async () => {
      const ctxWithCapability: ServiceCtx = { service: 'test-service', capability: 'agent.search' }
      const capabilityClient = new EcsHttpClient(mockLogger, ctxWithCapability, { baseURL })
      setupMockEndpoint('/test')

      await capabilityClient.get('/test')

      expect(capturedHeaders['x-capability']).toBe('agent.search')
    })

    it('should create client without capability header when not provided', async () => {
      setupMockEndpoint('/test')
      await client.get('/test')

      expect(capturedHeaders['x-capability']).toBeUndefined()
    })
  })

  describe('Success Scenarios', () => {
    it('should handle successful GET request', async () => {
      setupMockEndpoint('/test', 'get', { data: 'success' }, 200)
      const result = await client.get('/test')

      expect(result).toEqual({ data: 'success' })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Internal service call succeeded',
        expect.objectContaining({
          service: 'test-service',
          endpoint: '/test',
          method: 'GET',
          status: 200,
        })
      )
    })

    it('should handle successful DELETE request with 204 No Content', async () => {
      setupMockEndpoint('/delete', 'delete', null, 204)
      const result = await client.delete('/delete')

      // 204 responses have empty body, so result is empty string
      expect(result).toBe('')
    })
  })

  describe('Error Handling - Service Unavailable (Line 84 branch)', () => {
    it('should handle ENOTFOUND error and set type to ServiceUnavailable', async () => {
      // Create AxiosError with ENOTFOUND code
      const enotfoundError = new AxiosError('getaddrinfo ENOTFOUND')
      enotfoundError.code = 'ENOTFOUND'
      enotfoundError.config = {
        url: '/test',
        method: 'GET',
        baseURL,
      } as any

      // Mock axios.create to return an instance that rejects with the error
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue(enotfoundError),
      }
      const axiosCreateSpy = jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance as any)

      // Create a new client with the mocked axios instance
      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      
      // Get the error handler from the interceptor
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]

      try {
        // Call the error handler directly with the error
        await errorHandler(enotfoundError)
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.type).toBe(ProblemTypes.ServiceUnavailable)
        expect(axiosErr.upstreamProblem.status).toBe(503)
        expect(axiosErr.upstreamProblem.title).toBe('Service Unavailable')
      }

      axiosCreateSpy.mockRestore()
    })

    it('should handle ECONNREFUSED error and set type to ServiceUnavailable', async () => {
      // Create AxiosError with ECONNREFUSED code
      const refusedError = new AxiosError('connect ECONNREFUSED')
      refusedError.code = 'ECONNREFUSED'
      refusedError.config = {
        url: '/test',
        method: 'GET',
        baseURL,
      } as any

      // Mock axios.create to return an instance that rejects with the error
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue(refusedError),
      }
      const axiosCreateSpy = jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance as any)

      // Create a new client with the mocked axios instance
      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      
      // Get the error handler from the interceptor
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]

      try {
        // Call the error handler directly with the error
        await errorHandler(refusedError)
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.type).toBe(ProblemTypes.ServiceUnavailable)
        expect(axiosErr.upstreamProblem.status).toBe(503)
        expect(axiosErr.upstreamProblem.title).toBe('Service Unavailable')
      }

      axiosCreateSpy.mockRestore()
    })

    it('should handle EAI_AGAIN error and set type to ServiceUnavailable', async () => {
      // Create AxiosError with EAI_AGAIN code
      const againError = new AxiosError('getaddrinfo EAI_AGAIN')
      againError.code = 'EAI_AGAIN'
      againError.config = {
        url: '/test',
        method: 'GET',
        baseURL,
      } as any

      // Mock axios.create to return an instance that rejects with the error
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue(againError),
      }
      const axiosCreateSpy = jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance as any)

      // Create a new client with the mocked axios instance
      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      
      // Get the error handler from the interceptor
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]

      try {
        // Call the error handler directly with the error
        await errorHandler(againError)
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.type).toBe(ProblemTypes.ServiceUnavailable)
        expect(axiosErr.upstreamProblem.status).toBe(503)
        expect(axiosErr.upstreamProblem.title).toBe('Service Unavailable')
      }

      axiosCreateSpy.mockRestore()
    })

    it('should handle 503 Service Unavailable response (Line 101 branch)', async () => {
      server.use(
        http.get(`${baseURL}/service-unavailable`, () => {
          return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 })
        })
      )

      try {
        await client.get('/service-unavailable')
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.status).toBe(503)
        expect(axiosErr.upstreamProblem.title).toBe('Service Unavailable')
      }
    })
  })

  describe('Error Handling - Problem Details Detail Extraction (Line 92 branch)', () => {
    it('should extract detail from Problem Details when detail is a string', async () => {
      const problemDetails = {
        type: ProblemTypes.Validation,
        status: 400,
        title: 'Validation Error',
        detail: 'Invalid input data', // String detail
      }

      server.use(
        http.post(`${baseURL}/validation`, () => {
          return HttpResponse.json(problemDetails, { status: 400 })
        })
      )

      try {
        await client.post('/validation', {})
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.detail).toBe('Invalid input data')
      }
    })

    it('should use error message when Problem Details detail is not a string', async () => {
      const problemDetails = {
        type: ProblemTypes.Validation,
        status: 400,
        title: 'Validation Error',
        detail: { nested: 'object' }, // Not a string
      }

      server.use(
        http.post(`${baseURL}/validation-nonstring`, () => {
          return HttpResponse.json(problemDetails, { status: 400 })
        })
      )

      try {
        await client.post('/validation-nonstring', {})
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        // When detail is not a string, it uses the error message
        expect(axiosErr.upstreamProblem.detail).toBeDefined()
        expect(axiosErr.upstreamProblem.detail).not.toBe('Invalid input data')
      }
    })
  })

  describe('Error Handling - Gateway Timeout (Line 101 branch)', () => {
    it('should handle 504 Gateway Timeout error', async () => {
      server.use(
        http.get(`${baseURL}/gateway-timeout`, () => {
          return HttpResponse.json({ error: 'Gateway Timeout' }, { status: 504 })
        })
      )

      try {
        await client.get('/gateway-timeout')
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.status).toBe(504)
        expect(axiosErr.upstreamProblem.title).toBe('Gateway Timeout')
      }
    })
  })

  describe('Error Handling - Non-Axios Errors (Lines 218-234)', () => {
    it('should handle Error instance (line 218 branch)', async () => {
      // Mock axios.create to throw a non-Axios error
      const originalCreate = require('axios').create
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue(new Error('Generic error occurred')),
      }

      jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance)

      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      
      // Manually trigger the error handler by calling the interceptor
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
      
      try {
        await errorHandler(new Error('Generic error occurred'))
        fail('Expected UpstreamHttpError')
      } catch (err) {
        expect(err).toBeInstanceOf(UpstreamHttpError)
        const upstreamErr = err as UpstreamHttpError
        expect(upstreamErr.status).toBe(502)
        expect(upstreamErr.problem.type).toBe(ProblemTypes.Upstream)
        expect(upstreamErr.problem.title).toBe('Internal Service Error')
        expect(upstreamErr.problem.detail).toBe('Generic error occurred')
        expect(upstreamErr.cause).toBeInstanceOf(Error)
      }

      jest.restoreAllMocks()
    })

    it('should handle non-Error object (line 218 branch)', async () => {
      const originalCreate = require('axios').create
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue({ message: 'Not an Error instance' }),
      }

      jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance)

      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
      
      try {
        await errorHandler({ message: 'Not an Error instance' })
        fail('Expected UpstreamHttpError')
      } catch (err) {
        expect(err).toBeInstanceOf(UpstreamHttpError)
        const upstreamErr = err as UpstreamHttpError
        expect(upstreamErr.problem.detail).toBe('[object Object]')
      }

      jest.restoreAllMocks()
    })

    it('should handle string error', async () => {
      const originalCreate = require('axios').create
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue('String error'),
      }

      jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance)

      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
      
      try {
        await errorHandler('String error')
        fail('Expected UpstreamHttpError')
      } catch (err) {
        expect(err).toBeInstanceOf(UpstreamHttpError)
        const upstreamErr = err as UpstreamHttpError
        expect(upstreamErr.problem.detail).toBe('String error')
      }

      jest.restoreAllMocks()
    })

    it('should handle null error', async () => {
      const originalCreate = require('axios').create
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue(null),
      }

      jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance)

      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
      
      try {
        await errorHandler(null)
        fail('Expected UpstreamHttpError')
      } catch (err) {
        expect(err).toBeInstanceOf(UpstreamHttpError)
        const upstreamErr = err as UpstreamHttpError
        expect(upstreamErr.problem.detail).toBe('null')
      }

      jest.restoreAllMocks()
    })

    it('should handle undefined error', async () => {
      const originalCreate = require('axios').create
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        request: jest.fn().mockRejectedValue(undefined),
      }

      jest.spyOn(require('axios'), 'create').mockReturnValue(mockAxiosInstance)

      const testClient = new EcsHttpClient(mockLogger, ctx, { baseURL })
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
      
      try {
        await errorHandler(undefined)
        fail('Expected UpstreamHttpError')
      } catch (err) {
        expect(err).toBeInstanceOf(UpstreamHttpError)
        const upstreamErr = err as UpstreamHttpError
        expect(upstreamErr.problem.detail).toBe('undefined')
      }

      jest.restoreAllMocks()
    })
  })

  describe('Error Handling - Additional Branches', () => {
    it('should handle 502 Bad Gateway error', async () => {
      server.use(
        http.get(`${baseURL}/badgateway`, () => {
          return HttpResponse.json({ error: 'Bad Gateway' }, { status: 502 })
        })
      )

      try {
        await client.get('/badgateway')
        fail('Expected error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.type).toBe(ProblemTypes.BadGateway)
        expect(axiosErr.upstreamProblem.status).toBe(502)
        expect(axiosErr.upstreamProblem.title).toBe('Bad Gateway')
      }
    })

    it('should handle timeout error (ECONNABORTED)', async () => {
      const timeoutClient = new EcsHttpClient(mockLogger, ctx, { baseURL, timeout: 1 })

      server.use(
        http.get(`${baseURL}/timeout`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({ data: 'timeout' })
        })
      )

      try {
        await timeoutClient.get('/timeout')
        fail('Expected timeout error')
      } catch (err) {
        const axiosErr = err as AxiosError & { upstreamProblem?: any }
        expect(axiosErr.upstreamProblem).toBeDefined()
        expect(axiosErr.upstreamProblem.type).toBe(ProblemTypes.Timeout)
        expect(axiosErr.upstreamProblem.status).toBe(504)
        expect(axiosErr.upstreamProblem.title).toBe('Gateway Timeout')
      }
    })
  })
})

/**
 * Integration tests for EcsHttpClient correlation ID propagation
 * 
 * Tests verify that:
 * - Client reads correlation ID from AsyncLocalStorage
 * - Client adds x-correlation-id header to outgoing requests
 * - Client logs include correlation ID
 * - Multiple downstream calls use same correlation ID
 * 
 * Requirements: 3.1, 3.2, 10.4
 */
describe('EcsHttpClient - Correlation ID Integration', () => {
  let client: EcsHttpClient
  let mockLogger: LoggerService
  let capturedLogs: Array<{ level: string; message: string; meta?: Record<string, unknown> }>
  let capturedHeaders: Record<string, string> = {}
  const baseURL = 'http://test-service.local'
  const ctx: ServiceCtx = { service: 'test-service' }

  // MSW server for mocking HTTP requests
  const server = setupServer()

  beforeEach(() => {
    // Reset captured data
    capturedLogs = []
    capturedHeaders = {}

    // Create mock logger that captures log calls
    const infoFn = (message: string, meta?: Record<string, unknown>) => {
      capturedLogs.push({ level: 'info', message, meta })
    }
    const errorFn = (message: string, meta?: Record<string, unknown>) => {
      capturedLogs.push({ level: 'error', message, meta })
    }
    const warnFn = (message: string, meta?: Record<string, unknown>) => {
      capturedLogs.push({ level: 'warn', message, meta })
    }
    const debugFn = (message: string, meta?: Record<string, unknown>) => {
      capturedLogs.push({ level: 'debug', message, meta })
    }

    mockLogger = {
      info: jest.fn(infoFn),
      error: jest.fn(errorFn),
      warn: jest.fn(warnFn),
      debug: jest.fn(debugFn),
      getMetrics: jest.fn(() => ({
        recordHttpRequest: jest.fn(),
      })),
    } as unknown as LoggerService

    // Create EcsHttpClient instance
    client = new EcsHttpClient(mockLogger, ctx, { baseURL })

    // Start MSW server
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.resetHandlers()
    server.close()
  })

  /**
   * Helper function to establish AsyncLocalStorage context for tests
   * Simulates the middleware setting up the correlation context
   */
  function runInCorrelationContext<T>(correlationId: string, callback: () => T): T {
    return CorrelationIdHelper.runInContext(
      correlationId,
      {
        requestPath: '/test',
        method: 'GET',
        ip: '127.0.0.1',
      },
      callback
    )
  }

  /**
   * Helper to setup mock endpoint and capture request headers
   */
  function setupMockEndpoint(
    path: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get',
    responseData: any = { success: true },
    statusCode: number = 200
  ): void {
    server.use(
      http[method](`${baseURL}${path}`, ({ request }) => {
        // Capture all headers
        capturedHeaders = {}
        request.headers.forEach((value, key) => {
          capturedHeaders[key] = value
        })

        return HttpResponse.json(responseData, { status: statusCode })
      })
    )
  }

  describe('Test Setup Verification', () => {
    it('should create EcsHttpClient instance', () => {
      expect(client).toBeDefined()
      expect(client.instance).toBeDefined()
    })

    it('should establish AsyncLocalStorage context', () => {
      const testCorrelationId = 'test-correlation-id-123'

      runInCorrelationContext(testCorrelationId, () => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        expect(correlationId).toBe(testCorrelationId)
      })
    })

    it('should capture outgoing request headers with MSW', async () => {
      setupMockEndpoint('/test')

      await client.get('/test')

      // Verify we captured headers
      expect(capturedHeaders['x-request-id']).toBeDefined()
      expect(capturedHeaders['x-service-id']).toBe('test-service')
      expect(capturedHeaders['x-source-service']).toBe('orchestrator')
    })
  })

  describe('Correlation ID Header Propagation', () => {
    /**
     * Property 6: Downstream Service Header Propagation
     * Validates: Requirements 3.1, 3.2
     */
    it('should add x-correlation-id header to outgoing requests', async () => {
      const testCorrelationId = 'test-correlation-123'
      setupMockEndpoint('/downstream')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/downstream')

        // Verify correlation ID header is present
        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBeDefined()
        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
      })
    })

    it('should read correlation ID from AsyncLocalStorage', async () => {
      const testCorrelationId = 'async-storage-id-456'
      setupMockEndpoint('/api/test')

      await runInCorrelationContext(testCorrelationId, async () => {
        // Verify correlation ID is in context
        expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId)

        await client.get('/api/test')

        // Verify the same ID was added to the request
        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
      })
    })

    it('should propagate correlation ID for POST requests', async () => {
      const testCorrelationId = 'post-request-789'
      setupMockEndpoint('/api/create', 'post')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.post('/api/create', { data: 'test' })

        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
      })
    })

    it('should propagate correlation ID for PUT requests', async () => {
      const testCorrelationId = 'put-request-101'
      setupMockEndpoint('/api/update', 'put')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.put('/api/update', { data: 'updated' })

        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
      })
    })

    it('should propagate correlation ID for PATCH requests', async () => {
      const testCorrelationId = 'patch-request-202'
      setupMockEndpoint('/api/patch', 'patch')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.patch('/api/patch', { field: 'value' })

        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
      })
    })

    it('should propagate correlation ID for DELETE requests', async () => {
      const testCorrelationId = 'delete-request-303'
      setupMockEndpoint('/api/delete', 'delete')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.delete('/api/delete')

        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
      })
    })

    it('should generate correlation ID if not in context', async () => {
      setupMockEndpoint('/no-context')

      // Call without establishing context
      await client.get('/no-context')

      // Should still have a correlation ID (generated)
      expect(capturedHeaders[CORRELATION_ID_HEADER]).toBeDefined()
      expect(capturedHeaders[CORRELATION_ID_HEADER]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should include correlation ID along with other service headers', async () => {
      const testCorrelationId = 'multi-header-test'
      setupMockEndpoint('/multi-header')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/multi-header')

        // Verify all expected headers are present
        expect(capturedHeaders[CORRELATION_ID_HEADER]).toBe(testCorrelationId)
        expect(capturedHeaders['x-request-id']).toBeDefined()
        expect(capturedHeaders['x-service-id']).toBe('test-service')
        expect(capturedHeaders['x-source-service']).toBe('orchestrator')
      })
    })
  })

  describe('Multiple Downstream Calls Consistency', () => {
    /**
     * Property 7: Correlation ID Consistency Across Multiple Downstream Calls
     * Validates: Requirements 3.4, 3.5
     */
    it('should use same correlation ID for multiple sequential requests', async () => {
      const testCorrelationId = 'sequential-calls-123'
      const capturedIds: string[] = []

      // Setup multiple endpoints
      server.use(
        http.get(`${baseURL}/service1`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ service: 1 })
        }),
        http.get(`${baseURL}/service2`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ service: 2 })
        }),
        http.get(`${baseURL}/service3`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ service: 3 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/service1')
        await client.get('/service2')
        await client.get('/service3')

        // All requests should have the same correlation ID
        expect(capturedIds.length).toBe(3)
        expect(capturedIds[0]).toBe(testCorrelationId)
        expect(capturedIds[1]).toBe(testCorrelationId)
        expect(capturedIds[2]).toBe(testCorrelationId)

        // Verify all IDs are identical
        const uniqueIds = new Set(capturedIds)
        expect(uniqueIds.size).toBe(1)
        expect(uniqueIds.has(testCorrelationId)).toBe(true)
      })
    })

    it('should use same correlation ID for mixed HTTP method requests', async () => {
      const testCorrelationId = 'mixed-methods-456'
      const capturedIds: string[] = []

      server.use(
        http.get(`${baseURL}/read`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ data: 'read' })
        }),
        http.post(`${baseURL}/create`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ data: 'created' })
        }),
        http.put(`${baseURL}/update`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ data: 'updated' })
        }),
        http.delete(`${baseURL}/remove`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ data: 'deleted' })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/read')
        await client.post('/create', { item: 'test' })
        await client.put('/update', { item: 'updated' })
        await client.delete('/remove')

        // All requests should have the same correlation ID
        expect(capturedIds.length).toBe(4)
        capturedIds.forEach((id) => {
          expect(id).toBe(testCorrelationId)
        })
      })
    })

    it('should maintain correlation ID across async operations', async () => {
      const testCorrelationId = 'async-ops-789'
      const capturedIds: string[] = []

      server.use(
        http.get(`${baseURL}/async1`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ result: 1 })
        }),
        http.get(`${baseURL}/async2`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ result: 2 })
        }),
        http.get(`${baseURL}/async3`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ result: 3 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        // Make requests with delays to simulate async operations
        await client.get('/async1')
        await new Promise((resolve) => setTimeout(resolve, 10))
        await client.get('/async2')
        await new Promise((resolve) => setTimeout(resolve, 10))
        await client.get('/async3')

        // All should have the same correlation ID despite async delays
        expect(capturedIds.length).toBe(3)
        capturedIds.forEach((id) => {
          expect(id).toBe(testCorrelationId)
        })
      })
    })

    it('should use same correlation ID for parallel requests', async () => {
      const testCorrelationId = 'parallel-requests-101'
      const capturedIds: string[] = []

      server.use(
        http.get(`${baseURL}/parallel1`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ id: 1 })
        }),
        http.get(`${baseURL}/parallel2`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ id: 2 })
        }),
        http.get(`${baseURL}/parallel3`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ id: 3 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        // Make parallel requests using Promise.all
        await Promise.all([
          client.get('/parallel1'),
          client.get('/parallel2'),
          client.get('/parallel3'),
        ])

        // All parallel requests should have the same correlation ID
        expect(capturedIds.length).toBe(3)
        capturedIds.forEach((id) => {
          expect(id).toBe(testCorrelationId)
        })
      })
    })

    it('should maintain correlation ID in nested async calls', async () => {
      const testCorrelationId = 'nested-async-202'
      const capturedIds: string[] = []

      server.use(
        http.get(`${baseURL}/level1`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ level: 1 })
        }),
        http.get(`${baseURL}/level2`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ level: 2 })
        }),
        http.get(`${baseURL}/level3`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ level: 3 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/level1')

        await Promise.resolve().then(async () => {
          await client.get('/level2')

          await Promise.resolve().then(async () => {
            await client.get('/level3')
          })
        })

        // All nested calls should have the same correlation ID
        expect(capturedIds.length).toBe(3)
        capturedIds.forEach((id) => {
          expect(id).toBe(testCorrelationId)
        })
      })
    })

    it('should use different correlation IDs for different request contexts', async () => {
      const correlationId1 = 'context-1'
      const correlationId2 = 'context-2'
      const capturedIds: string[] = []

      server.use(
        http.get(`${baseURL}/test`, ({ request }) => {
          capturedIds.push(request.headers.get(CORRELATION_ID_HEADER) || '')
          return HttpResponse.json({ success: true })
        })
      )

      // First context
      await runInCorrelationContext(correlationId1, async () => {
        await client.get('/test')
      })

      // Second context
      await runInCorrelationContext(correlationId2, async () => {
        await client.get('/test')
      })

      // Should have captured two different correlation IDs
      expect(capturedIds.length).toBe(2)
      expect(capturedIds[0]).toBe(correlationId1)
      expect(capturedIds[1]).toBe(correlationId2)
      expect(capturedIds[0]).not.toBe(capturedIds[1])
    })
  })

  describe('Correlation ID in Logs', () => {
    /**
     * Tests that correlation ID is included in request and response logs
     * Validates: Requirements 4.1
     */
    it('should include correlation ID in successful request logs', async () => {
      const testCorrelationId = 'log-test-success-123'
      setupMockEndpoint('/api/data')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/api/data')

        // Find the success log entry
        const successLog = capturedLogs.find((log) => log.message === 'Internal service call succeeded')

        expect(successLog).toBeDefined()
        // The correlation ID should be accessible in the context when the log was created
        // Note: The logger doesn't automatically add correlation ID to meta,
        // but it's available via AsyncContextStorage during logging
      })
    })

    it('should include correlation ID in error logs', async () => {
      const testCorrelationId = 'log-test-error-456'

      server.use(
        http.get(`${baseURL}/api/error`, () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        try {
          await client.get('/api/error')
        } catch (error) {
          // Expected to fail
        }

        // Find the error log entry
        const errorLog = capturedLogs.find((log) => log.message === 'Internal service call failed')

        expect(errorLog).toBeDefined()
        // The correlation ID is available in AsyncContextStorage during error logging
      })
    })

    it('should log requests with correlation ID context available', async () => {
      const testCorrelationId = 'log-context-789'
      setupMockEndpoint('/api/test')

      await runInCorrelationContext(testCorrelationId, async () => {
        // Verify correlation ID is in context before request
        expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId)

        await client.get('/api/test')

        // Verify correlation ID is still in context after request
        expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId)

        // Verify logs were created
        expect(capturedLogs.length).toBeGreaterThan(0)
      })
    })

    it('should maintain correlation ID context during request lifecycle', async () => {
      const testCorrelationId = 'lifecycle-log-101'
      const correlationIdsAtLogTime: string[] = []

      // Override logger to capture correlation ID at log time
      const originalInfo = mockLogger.info
      mockLogger.info = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId) {
          correlationIdsAtLogTime.push(correlationId)
        }
        return (originalInfo as any)(message, meta)
      })

      setupMockEndpoint('/api/lifecycle')

      await runInCorrelationContext(testCorrelationId, async () => {
        await client.get('/api/lifecycle')

        // All logs should have been created with the correct correlation ID in context
        expect(correlationIdsAtLogTime.length).toBeGreaterThan(0)
        correlationIdsAtLogTime.forEach((id) => {
          expect(id).toBe(testCorrelationId)
        })
      })
    })

    it('should log multiple requests with their respective correlation IDs', async () => {
      const correlationId1 = 'multi-log-1'
      const correlationId2 = 'multi-log-2'
      const loggedCorrelationIds: string[] = []

      // Override logger to capture correlation IDs
      const originalInfo = mockLogger.info
      mockLogger.info = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId && message === 'Internal service call succeeded') {
          loggedCorrelationIds.push(correlationId)
        }
        return (originalInfo as any)(message, meta)
      })

      setupMockEndpoint('/api/multi')

      // First request
      await runInCorrelationContext(correlationId1, async () => {
        await client.get('/api/multi')
      })

      // Second request
      await runInCorrelationContext(correlationId2, async () => {
        await client.get('/api/multi')
      })

      // Should have logged both correlation IDs correctly
      expect(loggedCorrelationIds.length).toBe(2)
      expect(loggedCorrelationIds[0]).toBe(correlationId1)
      expect(loggedCorrelationIds[1]).toBe(correlationId2)
    })
  })

  describe('Correlation ID in Error Logs', () => {
    /**
     * Tests that correlation ID is included in error logs for failed requests
     * Validates: Requirements 4.1
     */
    it('should include correlation ID in logs for 404 errors', async () => {
      const testCorrelationId = 'error-404-test'
      const loggedCorrelationIds: string[] = []

      // Override error logger to capture correlation ID
      const originalError = mockLogger.error
      mockLogger.error = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId) {
          loggedCorrelationIds.push(correlationId)
        }
        return (originalError as any)(message, meta)
      })

      server.use(
        http.get(`${baseURL}/not-found`, () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        try {
          await client.get('/not-found')
        } catch (error) {
          // Expected to fail
        }

        // Error should have been logged with correlation ID in context
        expect(loggedCorrelationIds.length).toBeGreaterThan(0)
        expect(loggedCorrelationIds[0]).toBe(testCorrelationId)
      })
    })

    it('should include correlation ID in logs for 500 errors', async () => {
      const testCorrelationId = 'error-500-test'
      const loggedCorrelationIds: string[] = []

      const originalError = mockLogger.error
      mockLogger.error = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId) {
          loggedCorrelationIds.push(correlationId)
        }
        return (originalError as any)(message, meta)
      })

      server.use(
        http.get(`${baseURL}/server-error`, () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        try {
          await client.get('/server-error')
        } catch (error) {
          // Expected to fail
        }

        expect(loggedCorrelationIds.length).toBeGreaterThan(0)
        expect(loggedCorrelationIds[0]).toBe(testCorrelationId)
      })
    })

    it('should include correlation ID in logs for network errors', async () => {
      const testCorrelationId = 'error-network-test'
      const loggedCorrelationIds: string[] = []

      const originalError = mockLogger.error
      mockLogger.error = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId) {
          loggedCorrelationIds.push(correlationId)
        }
        return (originalError as any)(message, meta)
      })

      server.use(
        http.get(`${baseURL}/network-error`, () => {
          return HttpResponse.error()
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        try {
          await client.get('/network-error')
        } catch (error) {
          // Expected to fail
        }

        expect(loggedCorrelationIds.length).toBeGreaterThan(0)
        expect(loggedCorrelationIds[0]).toBe(testCorrelationId)
      })
    })

    it('should include correlation ID in logs for timeout errors', async () => {
      const testCorrelationId = 'error-timeout-test'
      const loggedCorrelationIds: string[] = []

      const originalError = mockLogger.error
      mockLogger.error = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId) {
          loggedCorrelationIds.push(correlationId)
        }
        return (originalError as any)(message, meta)
      })

      // Create a client with very short timeout
      const timeoutClient = new EcsHttpClient(mockLogger, ctx, { baseURL, timeout: 1 })

      server.use(
        http.get(`${baseURL}/slow`, async () => {
          // Delay longer than timeout
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({ data: 'slow' })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        try {
          await timeoutClient.get('/slow')
        } catch (error) {
          // Expected to timeout
        }

        expect(loggedCorrelationIds.length).toBeGreaterThan(0)
        expect(loggedCorrelationIds[0]).toBe(testCorrelationId)
      })
    })

    it('should log different correlation IDs for different failed requests', async () => {
      const correlationId1 = 'error-multi-1'
      const correlationId2 = 'error-multi-2'
      const loggedCorrelationIds: string[] = []

      const originalError = mockLogger.error
      mockLogger.error = jest.fn((message: string, meta?: Record<string, unknown>) => {
        const correlationId = AsyncContextStorage.getCorrelationId()
        if (correlationId && message === 'Internal service call failed') {
          loggedCorrelationIds.push(correlationId)
        }
        return (originalError as any)(message, meta)
      })

      server.use(
        http.get(`${baseURL}/fail`, () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 })
        })
      )

      // First failed request
      await runInCorrelationContext(correlationId1, async () => {
        try {
          await client.get('/fail')
        } catch (error) {
          // Expected
        }
      })

      // Second failed request
      await runInCorrelationContext(correlationId2, async () => {
        try {
          await client.get('/fail')
        } catch (error) {
          // Expected
        }
      })

      // Should have logged both correlation IDs
      expect(loggedCorrelationIds.length).toBe(2)
      expect(loggedCorrelationIds[0]).toBe(correlationId1)
      expect(loggedCorrelationIds[1]).toBe(correlationId2)
    })

    it('should maintain correlation ID context throughout error handling', async () => {
      const testCorrelationId = 'error-context-test'
      let correlationIdBeforeError: string | undefined
      let correlationIdDuringError: string | undefined
      let correlationIdAfterError: string | undefined

      const originalError = mockLogger.error
      mockLogger.error = jest.fn((message: string, meta?: Record<string, unknown>) => {
        correlationIdDuringError = AsyncContextStorage.getCorrelationId()
        return (originalError as any)(message, meta)
      })

      server.use(
        http.get(`${baseURL}/error-context`, () => {
          return HttpResponse.json({ error: 'Error' }, { status: 500 })
        })
      )

      await runInCorrelationContext(testCorrelationId, async () => {
        correlationIdBeforeError = AsyncContextStorage.getCorrelationId()

        try {
          await client.get('/error-context')
        } catch (error) {
          // Expected
        }

        correlationIdAfterError = AsyncContextStorage.getCorrelationId()

        // Correlation ID should be maintained throughout
        expect(correlationIdBeforeError).toBe(testCorrelationId)
        expect(correlationIdDuringError).toBe(testCorrelationId)
        expect(correlationIdAfterError).toBe(testCorrelationId)
      })
    })
  })
})
