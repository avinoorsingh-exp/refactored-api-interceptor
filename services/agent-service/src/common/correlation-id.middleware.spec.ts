/**
 * Unit tests for CorrelationIdMiddleware
 *
 * Tests correlation ID extraction, generation, and response header setting.
 * Validates Requirements 8.1, 8.2, 8.3
 */

import { CorrelationIdMiddleware } from './correlation-id.middleware.js'
import { CorrelationIdHelper, CORRELATION_ID_HEADER, AsyncContextStorage } from '@exprealty/cache'
import { createMockRequest, createMockResponse } from '../../../../test/utils/mock-factories.js'
import * as fc from 'fast-check'
import { correlationIdArbitrary } from '../../../../test/utils/generators.js'

describe('CorrelationIdMiddleware', () => {
	let middleware: CorrelationIdMiddleware

	beforeEach(() => {
		middleware = new CorrelationIdMiddleware()
	})

	describe('correlation ID extraction', () => {
		/**
		 * Requirement 8.1: WHEN testing CorrelationIdMiddleware with existing correlation ID header
		 * THEN the test suite SHALL verify the ID is preserved and passed through
		 */
		it('should preserve existing correlation ID from request header', (done) => {
			const existingCorrelationId = '550e8400-e29b-41d4-a716-446655440000'
			const mockReq = createMockRequest({
				headers: { [CORRELATION_ID_HEADER]: existingCorrelationId },
				path: '/api/test',
				method: 'GET',
			}) as any
			const mockRes = createMockResponse() as any
			const next = jest.fn(() => {
				// Verify correlation ID is available in context
				const contextId = AsyncContextStorage.getCorrelationId()
				expect(contextId).toBe(existingCorrelationId)
				done()
			})

			middleware.use(mockReq, mockRes, next)

			expect(mockRes.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, existingCorrelationId)
			expect(next).toHaveBeenCalled()
		})

		/**
		 * Requirement 8.2: WHEN testing CorrelationIdMiddleware without correlation ID header
		 * THEN the test suite SHALL verify a new ID is generated
		 */
		it('should generate new correlation ID when header is missing', (done) => {
			const mockReq = createMockRequest({
				headers: {},
				path: '/api/test',
				method: 'POST',
			}) as any
			const mockRes = createMockResponse() as any
			const next = jest.fn(() => {
				// Verify a correlation ID was generated and is in context
				const contextId = AsyncContextStorage.getCorrelationId()
				expect(contextId).toBeDefined()
				expect(typeof contextId).toBe('string')
				expect(contextId!.length).toBeGreaterThan(0)
				done()
			})

			middleware.use(mockReq, mockRes, next)

			expect(mockRes.setHeader).toHaveBeenCalled()
			const setHeaderCall = mockRes.setHeader.mock.calls[0]
			expect(setHeaderCall[0]).toBe(CORRELATION_ID_HEADER)
			expect(typeof setHeaderCall[1]).toBe('string')
			expect(setHeaderCall[1].length).toBeGreaterThan(0)
			expect(next).toHaveBeenCalled()
		})

		it('should generate new correlation ID when header is empty string', (done) => {
			const mockReq = createMockRequest({
				headers: { [CORRELATION_ID_HEADER]: '' },
				path: '/api/test',
				method: 'GET',
			}) as any
			const mockRes = createMockResponse() as any
			const next = jest.fn(() => {
				const contextId = AsyncContextStorage.getCorrelationId()
				expect(contextId).toBeDefined()
				expect(contextId!.length).toBeGreaterThan(0)
				done()
			})

			middleware.use(mockReq, mockRes, next)

			expect(next).toHaveBeenCalled()
		})
	})

	describe('response header setting', () => {
		/**
		 * Requirement 8.3: WHEN testing CorrelationIdMiddleware
		 * THEN the test suite SHALL verify correlation ID is set on response header
		 */
		it('should set correlation ID on response header', () => {
			const correlationId = 'test-correlation-id-123'
			const mockReq = createMockRequest({
				headers: { [CORRELATION_ID_HEADER]: correlationId },
				path: '/api/states',
				method: 'GET',
			}) as any
			const mockRes = createMockResponse() as any
			const next = jest.fn()

			middleware.use(mockReq, mockRes, next)

			expect(mockRes.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, correlationId)
		})

		it('should set generated correlation ID on response header when none provided', () => {
			const mockReq = createMockRequest({
				headers: {},
				path: '/api/companies',
				method: 'POST',
			}) as any
			const mockRes = createMockResponse() as any
			const next = jest.fn()

			middleware.use(mockReq, mockRes, next)

			expect(mockRes.setHeader).toHaveBeenCalledTimes(1)
			expect(mockRes.setHeader.mock.calls[0][0]).toBe(CORRELATION_ID_HEADER)
			// Generated ID should be a valid UUID-like string
			const generatedId = mockRes.setHeader.mock.calls[0][1]
			expect(typeof generatedId).toBe('string')
			expect(generatedId.length).toBeGreaterThan(0)
		})
	})

	describe('context metadata', () => {
		it('should store request metadata in context', (done) => {
			const mockReq = createMockRequest({
				headers: { [CORRELATION_ID_HEADER]: 'test-id' },
				path: '/api/regions',
				method: 'PUT',
				ip: '192.168.1.1',
			}) as any
			// Add ip property since our mock doesn't include it by default
			mockReq.ip = '192.168.1.1'
			
			const mockRes = createMockResponse() as any
			const next = jest.fn(() => {
				const context = AsyncContextStorage.getContext()
				expect(context).toBeDefined()
				expect(context?.requestPath).toBe('/api/regions')
				expect(context?.method).toBe('PUT')
				expect(context?.ip).toBe('192.168.1.1')
				done()
			})

			middleware.use(mockReq, mockRes, next)
		})
	})

	describe('Property 18: CorrelationIdMiddleware ID Handling', () => {
		/**
		 * **Feature: agent-service-coverage, Property 18: CorrelationIdMiddleware ID Handling**
		 * **Validates: Requirements 8.1, 8.3**
		 *
		 * *For any* request, CorrelationIdMiddleware SHALL either preserve an existing
		 * correlation ID header or generate a new one, and always set it on the response.
		 */
		it('should always set a valid correlation ID on response for any request', () => {
			fc.assert(
				fc.property(
					fc.option(correlationIdArbitrary, { nil: undefined }),
					fc.constantFrom('/api/states', '/api/companies', '/api/regions', '/health'),
					fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
					(maybeCorrelationId, path, method) => {
						const headers: Record<string, string> = {}
						if (maybeCorrelationId) {
							headers[CORRELATION_ID_HEADER] = maybeCorrelationId
						}

						const mockReq = createMockRequest({ headers, path, method }) as any
						const mockRes = createMockResponse() as any
						const next = jest.fn()

						middleware.use(mockReq, mockRes, next)

						// Property: Response header is always set
						expect(mockRes.setHeader).toHaveBeenCalledTimes(1)
						expect(mockRes.setHeader.mock.calls[0][0]).toBe(CORRELATION_ID_HEADER)

						const responseCorrelationId = mockRes.setHeader.mock.calls[0][1]

						// Property: Response correlation ID is always a non-empty string
						expect(typeof responseCorrelationId).toBe('string')
						expect(responseCorrelationId.length).toBeGreaterThan(0)

						// Property: If valid correlation ID was provided, it should be preserved
						if (maybeCorrelationId && CorrelationIdHelper.isValidCorrelationId(maybeCorrelationId)) {
							expect(responseCorrelationId).toBe(maybeCorrelationId)
						}

						// Property: next() is always called
						expect(next).toHaveBeenCalledTimes(1)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should generate new ID for invalid correlation IDs', () => {
			fc.assert(
				fc.property(
					fc.oneof(
						fc.constant(''),
						fc.constant('a'.repeat(101)), // Too long
						fc.constant('id\nwith\nnewlines'), // Contains newlines
					),
					(invalidCorrelationId) => {
						const mockReq = createMockRequest({
							headers: { [CORRELATION_ID_HEADER]: invalidCorrelationId },
							path: '/api/test',
							method: 'GET',
						}) as any
						const mockRes = createMockResponse() as any
						const next = jest.fn()

						middleware.use(mockReq, mockRes, next)

						const responseCorrelationId = mockRes.setHeader.mock.calls[0][1]

						// Property: Invalid IDs should result in a new generated ID
						expect(responseCorrelationId).not.toBe(invalidCorrelationId)
						expect(CorrelationIdHelper.isValidCorrelationId(responseCorrelationId)).toBe(true)
					},
				),
				{ numRuns: 50 },
			)
		})
	})
})
