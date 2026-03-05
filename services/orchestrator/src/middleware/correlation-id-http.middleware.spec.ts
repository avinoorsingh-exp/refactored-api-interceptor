import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { Request, Response, NextFunction } from 'express'
import * as fc from 'fast-check'
import { CorrelationIdHttpMiddleware } from './correlation-id-http.middleware.js'
import {
	AsyncContextStorage,
	CorrelationIdHelper,
	CORRELATION_ID_HEADER,
} from '@exprealty/cache'

/**
 * Integration tests for CorrelationIdHttpMiddleware
 * 
 * Tests the middleware's ability to:
 * - Extract correlation IDs from request headers
 * - Generate correlation IDs when missing
 * - Set response headers
 * - Establish AsyncLocalStorage context
 */
describe('CorrelationIdHttpMiddleware', () => {
	let middleware: CorrelationIdHttpMiddleware
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let nextFunction: NextFunction

	/**
	 * Helper to create a mock Express request
	 */
	const createMockRequest = (correlationId?: string): Partial<Request> => {
		return {
			header: jest.fn((name: string) => {
				if (name === CORRELATION_ID_HEADER) {
					return correlationId
				}
				return undefined
			}) as unknown as Request['header'],
			path: '/test/path',
			method: 'GET',
			ip: '127.0.0.1',
		}
	}

	/**
	 * Helper to create a mock Express response
	 */
	const createMockResponse = (): {
		response: Partial<Response>
		headers: Map<string, string>
	} => {
		const headers = new Map<string, string>()
		const response: Partial<Response> = {
			setHeader: jest.fn((name: string, value: string) => {
				headers.set(name, value)
				return response as Response
			}) as unknown as Response['setHeader'],
			getHeader: jest.fn((name: string) => {
				return headers.get(name)
			}) as unknown as Response['getHeader'],
		}
		return { response, headers }
	}

	/**
	 * Helper to invoke middleware and capture results
	 */
	const invokeMiddleware = async (
		req: Partial<Request>,
		res: Partial<Response>,
	): Promise<void> => {
		return new Promise<void>((resolve, reject) => {
			const next: NextFunction = (error?: unknown) => {
				if (error) {
					reject(error)
				} else {
					resolve()
				}
			}

			middleware.use(req as Request, res as Response, next)
		})
	}

	beforeEach(() => {
		middleware = new CorrelationIdHttpMiddleware()
		nextFunction = jest.fn() as unknown as NextFunction
	})

	describe('Test Setup Validation', () => {
		it('should create middleware instance', () => {
			expect(middleware).toBeDefined()
			expect(middleware).toBeInstanceOf(CorrelationIdHttpMiddleware)
		})

		it('should create mock request with header method', () => {
			const req = createMockRequest('test-id')
			expect(req.header).toBeDefined()
			expect(req.header!(CORRELATION_ID_HEADER)).toBe('test-id')
		})

		it('should create mock response with setHeader method', () => {
			const { response, headers } = createMockResponse()
			expect(response.setHeader).toBeDefined()

			response.setHeader!(CORRELATION_ID_HEADER, 'test-value')
			expect(headers.get(CORRELATION_ID_HEADER)).toBe('test-value')
		})

		it('should invoke middleware successfully', async () => {
			const req = createMockRequest('test-id')
			const { response } = createMockResponse()

			await expect(invokeMiddleware(req, response)).resolves.toBeUndefined()
		})
	})

	describe('Correlation ID Extraction from Header', () => {
		/**
		 * Property 1: Correlation ID Round-Trip Consistency
		 * Validates: Requirements 1.1, 2.3
		 */
		it('should extract and return the same correlation ID from request header', async () => {
			const testCorrelationId = 'test-correlation-id-123'
			const req = createMockRequest(testCorrelationId)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			// Verify same ID in response header
			expect(headers.get(CORRELATION_ID_HEADER)).toBe(testCorrelationId)
		})

		it('should make correlation ID accessible via AsyncContextStorage', async () => {
			const testCorrelationId = 'test-correlation-id-456'
			const req = createMockRequest(testCorrelationId)
			const { response } = createMockResponse()

			let correlationIdInContext: string | undefined

			// Override next function to capture correlation ID from context
			const next: NextFunction = () => {
				correlationIdInContext = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			// Verify ID accessible via AsyncContextStorage
			expect(correlationIdInContext).toBe(testCorrelationId)
		})

		it('should preserve correlation ID with special characters', async () => {
			const specialIds = [
				'id-with-dashes',
				'id_with_underscores',
				'id.with.dots',
				'ID-WITH-CAPS',
				'123-numeric-456',
				'mixed_CASE-id.123',
			]

			for (const testId of specialIds) {
				const req = createMockRequest(testId)
				const { response, headers } = createMockResponse()

				await invokeMiddleware(req, response)

				expect(headers.get(CORRELATION_ID_HEADER)).toBe(testId)
			}
		})

		it('should handle UUID v4 format correlation IDs', async () => {
			const uuidV4 = '550e8400-e29b-41d4-a716-446655440000'
			const req = createMockRequest(uuidV4)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			expect(headers.get(CORRELATION_ID_HEADER)).toBe(uuidV4)
		})

		it('should handle maximum length (100 chars) correlation IDs', async () => {
			const maxLengthId = 'a'.repeat(100)
			const req = createMockRequest(maxLengthId)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			expect(headers.get(CORRELATION_ID_HEADER)).toBe(maxLengthId)
		})
	})

	describe('Correlation ID Generation When Missing', () => {
		const UUID_V4_REGEX =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

		it('should generate valid UUID v4 when correlation ID header is missing', async () => {
			const req = createMockRequest(undefined)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const generatedId = headers.get(CORRELATION_ID_HEADER)
			expect(generatedId).toBeDefined()
			expect(generatedId).toMatch(UUID_V4_REGEX)
		})

		it('should make generated correlation ID accessible via AsyncContextStorage', async () => {
			const req = createMockRequest(undefined)
			const { response } = createMockResponse()

			let correlationIdInContext: string | undefined

			const next: NextFunction = () => {
				correlationIdInContext = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			expect(correlationIdInContext).toBeDefined()
			expect(correlationIdInContext).toMatch(UUID_V4_REGEX)
		})

		it('should generate different IDs for different requests', async () => {
			const generatedIds = new Set<string>()

			for (let i = 0; i < 10; i++) {
				const req = createMockRequest(undefined)
				const { response, headers } = createMockResponse()

				await invokeMiddleware(req, response)

				const generatedId = headers.get(CORRELATION_ID_HEADER)
				expect(generatedId).toBeDefined()
				generatedIds.add(generatedId!)
			}

			// All generated IDs should be unique
			expect(generatedIds.size).toBe(10)
		})

		it('should generate valid UUID v4 format consistently', async () => {
			for (let i = 0; i < 5; i++) {
				const req = createMockRequest(undefined)
				const { response, headers } = createMockResponse()

				await invokeMiddleware(req, response)

				const generatedId = headers.get(CORRELATION_ID_HEADER)
				expect(generatedId).toMatch(UUID_V4_REGEX)
				expect(generatedId?.length).toBe(36) // UUID v4 length
			}
		})

		it('should set generated ID in both response header and context', async () => {
			const req = createMockRequest(undefined)
			const { response, headers } = createMockResponse()

			let correlationIdInContext: string | undefined

			const next: NextFunction = () => {
				correlationIdInContext = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			const responseHeaderId = headers.get(CORRELATION_ID_HEADER)

			expect(responseHeaderId).toBeDefined()
			expect(correlationIdInContext).toBeDefined()
			expect(responseHeaderId).toBe(correlationIdInContext)
		})
	})

	describe('Invalid Correlation ID Rejection', () => {
		const UUID_V4_REGEX =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

		it('should reject empty string and generate valid UUID v4', async () => {
			const req = createMockRequest('')
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const generatedId = headers.get(CORRELATION_ID_HEADER)
			expect(generatedId).toBeDefined()
			expect(generatedId).not.toBe('')
			expect(generatedId).toMatch(UUID_V4_REGEX)
		})

		it('should reject 101-character correlation ID and generate valid UUID v4', async () => {
			const longId = 'a'.repeat(101)
			const req = createMockRequest(longId)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const generatedId = headers.get(CORRELATION_ID_HEADER)
			expect(generatedId).toBeDefined()
			expect(generatedId).not.toBe(longId)
			expect(generatedId).toMatch(UUID_V4_REGEX)
			expect(generatedId!.length).toBeLessThanOrEqual(100)
		})

		it('should reject correlation ID containing newline (\\n) and generate valid UUID v4', async () => {
			const idWithNewline = 'test-id\ninjection'
			const req = createMockRequest(idWithNewline)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const generatedId = headers.get(CORRELATION_ID_HEADER)
			expect(generatedId).toBeDefined()
			expect(generatedId).not.toBe(idWithNewline)
			expect(generatedId).not.toContain('\n')
			expect(generatedId).toMatch(UUID_V4_REGEX)
		})

		it('should reject correlation ID containing carriage return (\\r) and generate valid UUID v4', async () => {
			const idWithCR = 'test-id\rinjection'
			const req = createMockRequest(idWithCR)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const generatedId = headers.get(CORRELATION_ID_HEADER)
			expect(generatedId).toBeDefined()
			expect(generatedId).not.toBe(idWithCR)
			expect(generatedId).not.toContain('\r')
			expect(generatedId).toMatch(UUID_V4_REGEX)
		})

		it('should reject correlation ID containing both \\r and \\n', async () => {
			const idWithBoth = 'test-id\r\ninjection'
			const req = createMockRequest(idWithBoth)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const generatedId = headers.get(CORRELATION_ID_HEADER)
			expect(generatedId).toBeDefined()
			expect(generatedId).not.toBe(idWithBoth)
			expect(generatedId).not.toContain('\r')
			expect(generatedId).not.toContain('\n')
			expect(generatedId).toMatch(UUID_V4_REGEX)
		})

		it('should make generated ID accessible in context after rejection', async () => {
			const invalidId = 'a'.repeat(101)
			const req = createMockRequest(invalidId)
			const { response, headers } = createMockResponse()

			let correlationIdInContext: string | undefined

			const next: NextFunction = () => {
				correlationIdInContext = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			const responseHeaderId = headers.get(CORRELATION_ID_HEADER)

			expect(correlationIdInContext).toBeDefined()
			expect(correlationIdInContext).toMatch(UUID_V4_REGEX)
			expect(responseHeaderId).toBe(correlationIdInContext)
			expect(responseHeaderId).not.toBe(invalidId)
		})

		it('should handle multiple types of invalid IDs consistently', async () => {
			const invalidIds = [
				'', // empty
				'a'.repeat(101), // too long
				'test\nid', // newline
				'test\rid', // carriage return
				'test\r\nid', // both
			]

			for (const invalidId of invalidIds) {
				const req = createMockRequest(invalidId)
				const { response, headers } = createMockResponse()

				await invokeMiddleware(req, response)

				const generatedId = headers.get(CORRELATION_ID_HEADER)
				expect(generatedId).toBeDefined()
				expect(generatedId).not.toBe(invalidId)
				expect(generatedId).toMatch(UUID_V4_REGEX)
			}
		})
	})

	describe('Response Header Setting', () => {
		/**
		 * Property 5: Response Header Presence for All Status Codes
		 * Validates: Requirements 2.1, 2.2
		 */
		it('should set x-correlation-id response header', async () => {
			const testId = 'test-response-header'
			const req = createMockRequest(testId)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			expect(headers.has(CORRELATION_ID_HEADER)).toBe(true)
			expect(headers.get(CORRELATION_ID_HEADER)).toBe(testId)
		})

		it('should set response header before controller execution', async () => {
			const testId = 'test-before-controller'
			const req = createMockRequest(testId)
			const { response, headers } = createMockResponse()

			let headerValueInNext: string | undefined

			const next: NextFunction = () => {
				// Check if header is already set when next() is called
				headerValueInNext = headers.get(CORRELATION_ID_HEADER)
			}

			middleware.use(req as Request, response as Response, next)

			expect(headerValueInNext).toBe(testId)
		})

		it('should set response header value matching correlation ID in context', async () => {
			const testId = 'test-context-match'
			const req = createMockRequest(testId)
			const { response, headers } = createMockResponse()

			let correlationIdInContext: string | undefined

			const next: NextFunction = () => {
				correlationIdInContext = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			const responseHeaderId = headers.get(CORRELATION_ID_HEADER)

			expect(responseHeaderId).toBe(correlationIdInContext)
			expect(responseHeaderId).toBe(testId)
		})

		it('should set response header for generated correlation IDs', async () => {
			const req = createMockRequest(undefined)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const responseHeaderId = headers.get(CORRELATION_ID_HEADER)
			expect(responseHeaderId).toBeDefined()
			expect(headers.has(CORRELATION_ID_HEADER)).toBe(true)
		})

		it('should set response header for rejected invalid IDs', async () => {
			const invalidId = 'a'.repeat(101)
			const req = createMockRequest(invalidId)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			const responseHeaderId = headers.get(CORRELATION_ID_HEADER)
			expect(responseHeaderId).toBeDefined()
			expect(responseHeaderId).not.toBe(invalidId)
			expect(headers.has(CORRELATION_ID_HEADER)).toBe(true)
		})

		it('should always set exactly one correlation ID header', async () => {
			const testId = 'test-single-header'
			const req = createMockRequest(testId)
			const { response, headers } = createMockResponse()

			await invokeMiddleware(req, response)

			// Verify only one correlation ID header is set
			const headerValues = Array.from(headers.entries()).filter(
				([key]) => key === CORRELATION_ID_HEADER,
			)
			expect(headerValues.length).toBe(1)
			expect(headerValues[0][1]).toBe(testId)
		})

		it('should set response header consistently across multiple requests', async () => {
			const testIds = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5']

			for (const testId of testIds) {
				const req = createMockRequest(testId)
				const { response, headers } = createMockResponse()

				await invokeMiddleware(req, response)

				expect(headers.get(CORRELATION_ID_HEADER)).toBe(testId)
			}
		})
	})

	describe('AsyncLocalStorage Context Establishment', () => {
		/**
		 * Property 4: AsyncLocalStorage Context Availability
		 * Validates: Requirements 1.4, 4.2, 4.3, 4.4
		 */
		it('should make correlation ID accessible in next() callback', async () => {
			const testId = 'test-next-callback'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let correlationIdInNext: string | undefined

			const next: NextFunction = () => {
				correlationIdInNext = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			expect(correlationIdInNext).toBe(testId)
		})

		it('should make correlation ID accessible in async operations within next()', async () => {
			const testId = 'test-async-operations'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let correlationIdInAsync: string | undefined

			const next: NextFunction = async () => {
				// Simulate async operation
				await new Promise((resolve) => setTimeout(resolve, 10))
				correlationIdInAsync = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			// Wait for async operation to complete
			await new Promise((resolve) => setTimeout(resolve, 20))

			expect(correlationIdInAsync).toBe(testId)
		})

		it('should include requestPath in context', async () => {
			const testId = 'test-request-path'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let requestPathInContext: string | undefined

			const next: NextFunction = () => {
				requestPathInContext = AsyncContextStorage.getRequestPath()
			}

			middleware.use(req as Request, response as Response, next)

			expect(requestPathInContext).toBe('/test/path')
		})

		it('should include method in context', async () => {
			const testId = 'test-method'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let methodInContext: string | undefined

			const next: NextFunction = () => {
				methodInContext = AsyncContextStorage.getMethod()
			}

			middleware.use(req as Request, response as Response, next)

			expect(methodInContext).toBe('GET')
		})

		it('should include ip in context', async () => {
			const testId = 'test-ip'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let ipInContext: string | undefined

			const next: NextFunction = () => {
				ipInContext = AsyncContextStorage.getIp()
			}

			middleware.use(req as Request, response as Response, next)

			expect(ipInContext).toBe('127.0.0.1')
		})

		it('should include timestamp in context', async () => {
			const testId = 'test-timestamp'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let timestampInContext: number | undefined

			const next: NextFunction = () => {
				timestampInContext = AsyncContextStorage.getTimestamp()
			}

			middleware.use(req as Request, response as Response, next)

			expect(timestampInContext).toBeDefined()
			expect(typeof timestampInContext).toBe('number')
			expect(timestampInContext).toBeGreaterThan(0)
		})

		it('should establish complete context with all metadata', async () => {
			const testId = 'test-complete-context'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let contextInNext: ReturnType<typeof AsyncContextStorage.getContext>

			const next: NextFunction = () => {
				contextInNext = AsyncContextStorage.getContext()
			}

			middleware.use(req as Request, response as Response, next)

			expect(contextInNext).toBeDefined()
			expect(contextInNext?.correlationId).toBe(testId)
			expect(contextInNext?.requestPath).toBe('/test/path')
			expect(contextInNext?.method).toBe('GET')
			expect(contextInNext?.ip).toBe('127.0.0.1')
			expect(contextInNext?.timestamp).toBeDefined()
		})

		it('should preserve context across nested async operations', async () => {
			const testId = 'test-nested-async'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			const correlationIds: string[] = []

			const next: NextFunction = async () => {
				correlationIds.push(AsyncContextStorage.getCorrelationId()!)

				await new Promise((resolve) => setTimeout(resolve, 5))
				correlationIds.push(AsyncContextStorage.getCorrelationId()!)

				await Promise.resolve().then(() => {
					correlationIds.push(AsyncContextStorage.getCorrelationId()!)
				})

				await new Promise((resolve) => setTimeout(resolve, 5))
				correlationIds.push(AsyncContextStorage.getCorrelationId()!)
			}

			middleware.use(req as Request, response as Response, next)

			// Wait for all async operations
			await new Promise((resolve) => setTimeout(resolve, 20))

			// All should have the same correlation ID
			expect(correlationIds.length).toBe(4)
			correlationIds.forEach((id) => {
				expect(id).toBe(testId)
			})
		})
	})

	describe('Middleware Execution Order', () => {
		/**
		 * Property 10: Middleware Execution Order
		 * Validates: Requirements 9.2, 9.5
		 */
		it('should make correlation ID available at start of controller', async () => {
			const testId = 'test-controller-start'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let correlationIdAtControllerStart: string | undefined

			const next: NextFunction = () => {
				// Simulate controller execution - correlation ID should already be available
				correlationIdAtControllerStart = AsyncContextStorage.getCorrelationId()
			}

			middleware.use(req as Request, response as Response, next)

			expect(correlationIdAtControllerStart).toBe(testId)
		})

		it('should run before route handlers', async () => {
			const testId = 'test-before-handler'
			const req = createMockRequest(testId)
			const { response, headers } = createMockResponse()

			let headerSetBeforeHandler = false
			let contextAvailableInHandler = false

			const next: NextFunction = () => {
				// Check if header was already set by middleware
				headerSetBeforeHandler = headers.has(CORRELATION_ID_HEADER)
				// Check if context is available
				contextAvailableInHandler =
					AsyncContextStorage.getCorrelationId() !== undefined
			}

			middleware.use(req as Request, response as Response, next)

			expect(headerSetBeforeHandler).toBe(true)
			expect(contextAvailableInHandler).toBe(true)
		})

		it('should establish context before any controller logic executes', async () => {
			const testId = 'test-context-before-logic'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			const executionOrder: string[] = []

			const next: NextFunction = () => {
				executionOrder.push('controller-start')

				// Verify context is already available
				const correlationId = AsyncContextStorage.getCorrelationId()
				if (correlationId === testId) {
					executionOrder.push('context-available')
				}

				executionOrder.push('controller-end')
			}

			executionOrder.push('middleware-start')
			middleware.use(req as Request, response as Response, next)
			executionOrder.push('middleware-end')

			expect(executionOrder).toEqual([
				'middleware-start',
				'controller-start',
				'context-available',
				'controller-end',
				'middleware-end',
			])
		})

		it('should set response header before controller can modify response', async () => {
			const testId = 'test-header-before-controller'
			const req = createMockRequest(testId)
			const { response, headers } = createMockResponse()

			let headerValueWhenControllerStarts: string | undefined

			const next: NextFunction = () => {
				// Controller starts - header should already be set
				headerValueWhenControllerStarts = headers.get(CORRELATION_ID_HEADER)
			}

			middleware.use(req as Request, response as Response, next)

			expect(headerValueWhenControllerStarts).toBe(testId)
		})

		it('should maintain execution order with multiple middleware calls', async () => {
			const testIds = ['id-1', 'id-2', 'id-3']
			const results: Array<{ id: string; available: boolean }> = []

			for (const testId of testIds) {
				const req = createMockRequest(testId)
				const { response } = createMockResponse()

				const next: NextFunction = () => {
					const correlationId = AsyncContextStorage.getCorrelationId()
					results.push({
						id: correlationId!,
						available: correlationId !== undefined,
					})
				}

				middleware.use(req as Request, response as Response, next)
			}

			// Verify each request had its correlation ID available
			expect(results.length).toBe(3)
			results.forEach((result, index) => {
				expect(result.available).toBe(true)
				expect(result.id).toBe(testIds[index])
			})
		})

		it('should ensure correlation ID is accessible immediately in next()', async () => {
			const testId = 'test-immediate-access'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			let immediateAccess = false

			const next: NextFunction = () => {
				// First line of controller - should have immediate access
				const correlationId = AsyncContextStorage.getCorrelationId()
				immediateAccess = correlationId === testId
			}

			middleware.use(req as Request, response as Response, next)

			expect(immediateAccess).toBe(true)
		})

		it('should maintain context throughout entire request lifecycle', async () => {
			const testId = 'test-lifecycle'
			const req = createMockRequest(testId)
			const { response } = createMockResponse()

			const lifecycleChecks: Array<{ stage: string; id: string | undefined }> = []

			const next: NextFunction = async () => {
				lifecycleChecks.push({
					stage: 'controller-start',
					id: AsyncContextStorage.getCorrelationId(),
				})

				// Simulate some async work
				await new Promise((resolve) => setTimeout(resolve, 5))

				lifecycleChecks.push({
					stage: 'after-async',
					id: AsyncContextStorage.getCorrelationId(),
				})

				// Simulate more work
				await Promise.resolve()

				lifecycleChecks.push({
					stage: 'controller-end',
					id: AsyncContextStorage.getCorrelationId(),
				})
			}

			middleware.use(req as Request, response as Response, next)

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 20))

			// Verify correlation ID was available at all stages
			expect(lifecycleChecks.length).toBe(3)
			lifecycleChecks.forEach((check) => {
				expect(check.id).toBe(testId)
			})
		})
	})
})
