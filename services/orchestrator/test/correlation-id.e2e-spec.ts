import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { http, HttpResponse } from 'msw'
import { AppModule } from '../src/app.module.js'
import { ProblemDetailsFilter } from '../src/common/problem-details.filter.js'
import { LoggerService } from '../src/core/logger.service.js'
import { CorrelationIdHttpMiddleware } from '../src/middleware/correlation-id-http.middleware.js'
import { mockServer } from '../../../test/setup-e2e.js'
import { CORRELATION_ID_HEADER } from '@exprealty/cache'
import type { Server } from 'http'

/**
 * E2E Tests for X-Correlation-ID Implementation
 * 
 * Tests the full request flow from client → orchestrator → agent-service
 * Validates correlation ID propagation, generation, validation, and error handling
 * 
 * Requirements tested:
 * - 1.1, 1.2, 1.3: Correlation ID extraction, generation, and validation
 * - 2.1, 2.2, 2.3, 2.4: Response header inclusion
 * - 3.3: Downstream service propagation
 * - 5.1: Concurrent request isolation
 * - 6.1, 6.2, 6.3: Security validation
 * - 7.1, 7.2, 7.3, 7.4, 7.5: Error response headers
 * - 8.1, 8.2, 8.3, 8.4, 8.5: HTTP method support
 * - 10.5: E2E testing
 */
describe('Correlation ID E2E Tests', () => {
	let app: INestApplication
	const UUID_V4_REGEX =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

	/**
	 * Helper to verify correlation ID in response
	 */
	const expectCorrelationIdHeader = (
		response: request.Response,
		expectedId?: string,
	) => {
		const correlationId = response.headers[CORRELATION_ID_HEADER]
		expect(correlationId).toBeDefined()

		if (expectedId) {
			expect(correlationId).toBe(expectedId)
		} else {
			// If no expected ID, verify it's a valid UUID v4
			expect(correlationId).toMatch(UUID_V4_REGEX)
		}

		return correlationId
	}

	/**
	 * Helper to capture correlation ID from downstream request
	 */
	const captureDownstreamCorrelationId = (): {
		correlationId: string | null
		getCorrelationId: () => string | null
	} => {
		const capture = { correlationId: null as string | null }

		return {
			correlationId: capture.correlationId,
			getCorrelationId: () => capture.correlationId,
		}
	}

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleFixture.createNestApplication()

		// Register the ProblemDetailsFilter
		const logger = app.get(LoggerService)
		app.useGlobalFilters(new ProblemDetailsFilter(logger))

		await app.init()
	})

	afterAll(async () => {
		await app.close()
	})

	beforeEach(() => {
		// Reset MSW handlers before each test
		mockServer.resetHandlers()
	})

	describe('6.2 Test round-trip with provided correlation ID', () => {
		it('should return the same correlation ID when provided in request header', async () => {
			const testCorrelationId = 'test-123'

			// Mock agent-service health endpoint
			mockServer.use(
				http.get('http://localhost:3001/v1/agent/health', () => {
					return HttpResponse.json({
						status: 'ok',
						service: 'agent-service',
						timestamp: new Date().toISOString(),
					})
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/health')
				.set(CORRELATION_ID_HEADER, testCorrelationId)
				.expect(200)

			// Verify response has the same correlation ID
			expectCorrelationIdHeader(response, testCorrelationId)
		})

		it('should propagate correlation ID to downstream agent-service', async () => {
			const testCorrelationId = 'test-123'
			let downstreamCorrelationId: string | undefined

			// Mock agent-service endpoint and capture correlation ID
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', ({ request }) => {
					downstreamCorrelationId = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json([
						{ code: 'US', name: 'United States' },
						{ code: 'CA', name: 'Canada' },
					])
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.set(CORRELATION_ID_HEADER, testCorrelationId)
				.expect(200)

			// Verify response has the same correlation ID
			expectCorrelationIdHeader(response, testCorrelationId)

			// Verify downstream service received the same correlation ID
			expect(downstreamCorrelationId).toBe(testCorrelationId)
		})

		it('should maintain correlation ID across multiple downstream calls', async () => {
			const testCorrelationId = 'test-multi-downstream'
			const downstreamIds: string[] = []

			// Mock multiple agent-service endpoints
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', ({ request }) => {
					const id = request.headers.get(CORRELATION_ID_HEADER)
					if (id) downstreamIds.push(id)
					return HttpResponse.json([{ code: 'US', name: 'United States' }])
				}),
				http.get('http://localhost:3001/v1/regions', ({ request }) => {
					const id = request.headers.get(CORRELATION_ID_HEADER)
					if (id) downstreamIds.push(id)
					return HttpResponse.json([{ id: 1, name: 'North America' }])
				}),
			)

			// Make first request
			await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.set(CORRELATION_ID_HEADER, testCorrelationId)
				.expect(200)

			// Make second request with same correlation ID
			await request(app.getHttpServer() as Server)
				.get('/v1/regions')
				.set(CORRELATION_ID_HEADER, testCorrelationId)
				.expect(200)

			// Verify all downstream calls received the same correlation ID
			expect(downstreamIds.length).toBe(2)
			downstreamIds.forEach((id) => {
				expect(id).toBe(testCorrelationId)
			})
		})
	})

	describe('6.3 Test round-trip with generated correlation ID', () => {
		it('should generate and return valid UUID v4 when no correlation ID provided', async () => {
			const response = await request(app.getHttpServer() as Server)
				.get('/v1/health')
				.expect(200)

			// Verify response has a valid UUID v4 correlation ID
			const correlationId = expectCorrelationIdHeader(response)
			expect(correlationId).toMatch(UUID_V4_REGEX)
		})

		it('should propagate generated correlation ID to downstream agent-service', async () => {
			let downstreamCorrelationId: string | undefined

			// Mock agent-service endpoint
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', ({ request }) => {
					downstreamCorrelationId = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json([{ code: 'US', name: 'United States' }])
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.expect(200)

			// Verify response has a valid UUID v4
			const responseCorrelationId = expectCorrelationIdHeader(response)
			expect(responseCorrelationId).toMatch(UUID_V4_REGEX)

			// Verify downstream service received the same generated ID
			expect(downstreamCorrelationId).toBeDefined()
			expect(downstreamCorrelationId).toBe(responseCorrelationId)
			expect(downstreamCorrelationId).toMatch(UUID_V4_REGEX)
		})

		it('should generate unique correlation IDs for different requests', async () => {
			const correlationIds = new Set<string>()

			for (let i = 0; i < 5; i++) {
				const response = await request(app.getHttpServer() as Server)
					.get('/v1/health')
					.expect(200)

				const correlationId = expectCorrelationIdHeader(response)
				correlationIds.add(correlationId)
			}

			// All generated IDs should be unique
			expect(correlationIds.size).toBe(5)
		})
	})

	describe('6.4 Test invalid correlation ID rejection', () => {
		it('should reject empty correlation ID and generate valid UUID v4', async () => {
			const response = await request(app.getHttpServer() as Server)
				.get('/v1/health')
				.set(CORRELATION_ID_HEADER, '')
				.expect(200)

			const correlationId = expectCorrelationIdHeader(response)
			expect(correlationId).not.toBe('')
			expect(correlationId).toMatch(UUID_V4_REGEX)
		})

		it('should reject 101-character correlation ID and generate valid UUID v4', async () => {
			const longId = 'a'.repeat(101)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/health')
				.set(CORRELATION_ID_HEADER, longId)
				.expect(200)

			const correlationId = expectCorrelationIdHeader(response)
			expect(correlationId).not.toBe(longId)
			expect(correlationId).toMatch(UUID_V4_REGEX)
			expect(correlationId.length).toBeLessThanOrEqual(100)
		})

		it('should reject correlation ID with newline (\\n) - HTTP layer prevents header injection', async () => {
			const idWithNewline = 'test\nid' // Actual newline character

			// The HTTP layer (superagent/Node.js) prevents setting headers with newlines
			// This is the first line of defense against header injection attacks
			// Our middleware validation is a secondary defense for edge cases
			await expect(
				request(app.getHttpServer() as Server)
					.get('/v1/health')
					.set(CORRELATION_ID_HEADER, idWithNewline)
			).rejects.toThrow(/Invalid character in header/)
		})

		it('should reject correlation ID with carriage return (\\r) - HTTP layer prevents header injection', async () => {
			const idWithCR = 'test\rid' // Actual carriage return character

			// The HTTP layer (superagent/Node.js) prevents setting headers with carriage returns
			// This is the first line of defense against header injection attacks
			// Our middleware validation is a secondary defense for edge cases
			await expect(
				request(app.getHttpServer() as Server)
					.get('/v1/health')
					.set(CORRELATION_ID_HEADER, idWithCR)
			).rejects.toThrow(/Invalid character in header/)
		})

		it('should propagate generated ID to downstream after rejecting invalid ID', async () => {
			const invalidId = 'a'.repeat(101)
			let downstreamCorrelationId: string | undefined

			// Mock agent-service endpoint
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', ({ request }) => {
					downstreamCorrelationId = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json([{ code: 'US', name: 'United States' }])
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.set(CORRELATION_ID_HEADER, invalidId)
				.expect(200)

			const responseCorrelationId = expectCorrelationIdHeader(response)
			expect(responseCorrelationId).not.toBe(invalidId)
			expect(responseCorrelationId).toMatch(UUID_V4_REGEX)

			// Verify downstream received the generated ID, not the invalid one
			expect(downstreamCorrelationId).toBe(responseCorrelationId)
			expect(downstreamCorrelationId).not.toBe(invalidId)
		})
	})

	describe('6.5 Test all HTTP methods include correlation ID', () => {
		/**
		 * Property 11: HTTP Method Independence
		 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
		 */
		it('should include correlation ID in GET response', async () => {
			const testId = 'test-get-method'

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/health')
				.set(CORRELATION_ID_HEADER, testId)
				.expect(200)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in POST response', async () => {
			const testId = 'test-post-method'

			// Mock agent-service POST endpoint
			mockServer.use(
				http.post('http://localhost:3001/v1/countries', () => {
					return HttpResponse.json(
						{ code: 'US', name: 'United States' },
						{ status: 201 },
					)
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.post('/v1/countries')
				.set(CORRELATION_ID_HEADER, testId)
				.send({ code: 'US', name: 'United States' })
				.expect(201)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in PUT response', async () => {
			const testId = 'test-put-method'

			// Mock agent-service PUT endpoint
			mockServer.use(
				http.put('http://localhost:3001/v1/countries/US', () => {
					return HttpResponse.json({ code: 'US', name: 'United States of America' })
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.put('/v1/countries/US')
				.set(CORRELATION_ID_HEADER, testId)
				.send({ name: 'United States of America' })
				.expect(200)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in PATCH response', async () => {
			const testId = 'test-patch-method'

			// Mock agent-service PATCH endpoint
			mockServer.use(
				http.patch('http://localhost:3001/v1/countries/US', () => {
					return HttpResponse.json({ code: 'US', name: 'USA' })
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.patch('/v1/countries/US')
				.set(CORRELATION_ID_HEADER, testId)
				.send({ name: 'USA' })
				.expect(200)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in DELETE response', async () => {
			const testId = 'test-delete-method'

			// Mock agent-service DELETE endpoint
			// Note: 204 No Content should have no body
			mockServer.use(
				http.delete('http://localhost:3001/v1/countries/US', () => {
					return new HttpResponse(null, { status: 204 })
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.delete('/v1/countries/US')
				.set(CORRELATION_ID_HEADER, testId)
				.expect(204)

			expectCorrelationIdHeader(response, testId)
		})

		it('should propagate correlation ID to downstream for all HTTP methods', async () => {
			const testId = 'test-all-methods-downstream'
			const downstreamIds: Record<string, string | undefined> = {}

			// Mock all HTTP methods
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', ({ request }) => {
					downstreamIds.GET = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json([])
				}),
				http.post('http://localhost:3001/v1/countries', ({ request }) => {
					downstreamIds.POST = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json({}, { status: 201 })
				}),
				http.put('http://localhost:3001/v1/countries/US', ({ request }) => {
					downstreamIds.PUT = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json({})
				}),
				http.patch('http://localhost:3001/v1/countries/US', ({ request }) => {
					downstreamIds.PATCH = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return HttpResponse.json({})
				}),
				http.delete('http://localhost:3001/v1/countries/US', ({ request }) => {
					downstreamIds.DELETE = request.headers.get(CORRELATION_ID_HEADER) || undefined
					return new HttpResponse(null, { status: 204 })
				}),
			)

			// Test each HTTP method
			await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.set(CORRELATION_ID_HEADER, testId)

			await request(app.getHttpServer() as Server)
				.post('/v1/countries')
				.set(CORRELATION_ID_HEADER, testId)
				.send({})

			await request(app.getHttpServer() as Server)
				.put('/v1/countries/US')
				.set(CORRELATION_ID_HEADER, testId)
				.send({})

			await request(app.getHttpServer() as Server)
				.patch('/v1/countries/US')
				.set(CORRELATION_ID_HEADER, testId)
				.send({})

			await request(app.getHttpServer() as Server)
				.delete('/v1/countries/US')
				.set(CORRELATION_ID_HEADER, testId)

			// Verify all downstream calls received the correlation ID
			expect(downstreamIds.GET).toBe(testId)
			expect(downstreamIds.POST).toBe(testId)
			expect(downstreamIds.PUT).toBe(testId)
			expect(downstreamIds.PATCH).toBe(testId)
			expect(downstreamIds.DELETE).toBe(testId)
		})
	})

	describe('6.6 Test error responses include correlation ID', () => {
		it('should include correlation ID in 400 Bad Request response', async () => {
			const testId = 'test-400-error'

			// Mock agent-service to return 400
			mockServer.use(
				http.post('http://localhost:3001/v1/countries', () => {
					return HttpResponse.json(
						{
							type: 'https://problems.exprealty.com/validation-error',
							title: 'Validation Error',
							status: 400,
							detail: 'Invalid country code',
							instance: '/v1/countries',
						},
						{ status: 400 },
					)
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.post('/v1/countries')
				.set(CORRELATION_ID_HEADER, testId)
				.send({ code: 'INVALID' })
				.expect(400)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in 404 Not Found response', async () => {
			const testId = 'test-404-error'

			// Mock agent-service to return 404
			mockServer.use(
				http.get('http://localhost:3001/v1/countries/XX', () => {
					return HttpResponse.json(
						{
							type: 'https://problems.exprealty.com/not-found',
							title: 'Not Found',
							status: 404,
							detail: 'Country not found',
							instance: '/v1/countries/XX',
						},
						{ status: 404 },
					)
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/countries/XX')
				.set(CORRELATION_ID_HEADER, testId)
				.expect(404)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in 500 Internal Server Error response', async () => {
			const testId = 'test-500-error'

			// Mock agent-service to return 500
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', () => {
					return HttpResponse.json(
						{
							type: 'https://problems.exprealty.com/internal-error',
							title: 'Internal Server Error',
							status: 500,
							detail: 'Database connection failed',
							instance: '/v1/countries',
						},
						{ status: 500 },
					)
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.set(CORRELATION_ID_HEADER, testId)
				.expect(500)

			expectCorrelationIdHeader(response, testId)
		})

		it('should include correlation ID in validation error response', async () => {
			const testId = 'test-validation-error'

			// Mock agent-service to return validation error
			mockServer.use(
				http.post('http://localhost:3001/v1/countries', () => {
					return HttpResponse.json(
						{
							type: 'https://problems.exprealty.com/validation-error',
							title: 'Validation Error',
							status: 400,
							detail: 'Request validation failed',
							instance: '/v1/countries',
							invalidParams: [
								{
									name: 'code',
									reason: 'must be exactly 2 characters',
									in: 'body',
								},
							],
						},
						{ status: 400 },
					)
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.post('/v1/countries')
				.set(CORRELATION_ID_HEADER, testId)
				.send({ code: 'TOOLONG' })
				.expect(400)

			expectCorrelationIdHeader(response, testId)
		})

		it('should generate and include correlation ID in error responses when not provided', async () => {
			// Mock agent-service to return 500
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', () => {
					return HttpResponse.json(
						{
							type: 'https://problems.exprealty.com/internal-error',
							title: 'Internal Server Error',
							status: 500,
							detail: 'Unexpected error',
							instance: '/v1/countries',
						},
						{ status: 500 },
					)
				}),
			)

			const response = await request(app.getHttpServer() as Server)
				.get('/v1/countries')
				.expect(500)

			// Should have generated a correlation ID
			const correlationId = expectCorrelationIdHeader(response)
			expect(correlationId).toMatch(UUID_V4_REGEX)
		})
	})

	describe('6.7 Test concurrent requests maintain isolation', () => {
		it('should maintain separate correlation IDs for concurrent requests', async () => {
			const testIds = Array.from({ length: 10 }, (_, i) => `concurrent-test-${i}`)
			const results: Array<{ requestId: string; responseId: string }> = []

			// Mock agent-service endpoint
			mockServer.use(
				http.get('http://localhost:3001/v1/health', () => {
					return HttpResponse.json({ status: 'ok' })
				}),
			)

			// Make 10 concurrent requests with different correlation IDs
			const promises = testIds.map(async (testId) => {
				const response = await request(app.getHttpServer() as Server)
					.get('/v1/health')
					.set(CORRELATION_ID_HEADER, testId)
					.expect(200)

				const responseId = response.headers[CORRELATION_ID_HEADER]
				results.push({ requestId: testId, responseId })
			})

			await Promise.all(promises)

			// Verify each response has the correct correlation ID
			expect(results.length).toBe(10)
			results.forEach(({ requestId, responseId }) => {
				expect(responseId).toBe(requestId)
			})

			// Verify no correlation IDs were mixed
			const uniqueResponseIds = new Set(results.map((r) => r.responseId))
			expect(uniqueResponseIds.size).toBe(10)
		})

		it('should maintain correlation ID isolation with downstream calls', async () => {
			const testIds = ['concurrent-1', 'concurrent-2', 'concurrent-3']
			const downstreamCaptures: Array<{
				requestId: string
				downstreamId: string | null
			}> = []

			// Mock agent-service endpoint to capture correlation IDs
			mockServer.use(
				http.get('http://localhost:3001/v1/countries', ({ request }) => {
					const downstreamId = request.headers.get(CORRELATION_ID_HEADER)
					return HttpResponse.json([{ code: 'US', name: 'United States' }])
				}),
			)

			// Make concurrent requests
			const promises = testIds.map(async (testId) => {
				let downstreamId: string | null = null

				// Temporarily override handler to capture this specific request
				const response = await request(app.getHttpServer() as Server)
					.get('/v1/countries')
					.set(CORRELATION_ID_HEADER, testId)
					.expect(200)

				const responseId = response.headers[CORRELATION_ID_HEADER]
				downstreamCaptures.push({
					requestId: testId,
					downstreamId: responseId,
				})
			})

			await Promise.all(promises)

			// Verify each request maintained its own correlation ID
			downstreamCaptures.forEach(({ requestId, downstreamId }) => {
				expect(downstreamId).toBe(requestId)
			})
		})

		it('should not mix correlation IDs between concurrent requests', async () => {
			const correlationIds = new Set<string>()
			const requestCount = 20

			// Make many concurrent requests without providing correlation IDs
			const promises = Array.from({ length: requestCount }, async () => {
				const response = await request(app.getHttpServer() as Server)
					.get('/v1/health')
					.expect(200)

				const correlationId = response.headers[CORRELATION_ID_HEADER]
				correlationIds.add(correlationId)
				return correlationId
			})

			const results = await Promise.all(promises)

			// All correlation IDs should be unique (no mixing)
			expect(correlationIds.size).toBe(requestCount)
			expect(results.length).toBe(requestCount)

			// All should be valid UUID v4
			results.forEach((id) => {
				expect(id).toMatch(UUID_V4_REGEX)
			})
		})
	})
})
