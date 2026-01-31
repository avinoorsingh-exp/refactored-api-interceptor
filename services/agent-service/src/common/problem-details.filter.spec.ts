/**
 * Unit tests for ProblemDetailsFilter
 *
 * Tests HttpException, validation errors, QueryFailedError, ZodError, and generic Error handling.
 * Validates Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import {
	HttpException,
	BadRequestException,
	NotFoundException,
	ConflictException,
	ForbiddenException,
	UnauthorizedException,
	InternalServerErrorException,
} from '@nestjs/common'
import { ArgumentsHost } from '@nestjs/common'
import { ZodError, ZodIssue } from 'zod'
import { QueryFailedError } from 'typeorm'
import { ProblemDetailsFilter } from './problem-details.filter.js'
import { LoggerService } from '../core/logger.service.js'
import { ProblemTypes } from '@exprealty/shared-domain'
import { createMockRequest, createMockResponse } from '../../../../test/utils/mock-factories.js'
import * as fc from 'fast-check'

describe('ProblemDetailsFilter', () => {
	let filter: ProblemDetailsFilter
	let mockLogger: jest.Mocked<LoggerService>
	let mockRequest: ReturnType<typeof createMockRequest>
	let mockResponse: ReturnType<typeof createMockResponse>
	let mockHost: ArgumentsHost

	beforeEach(() => {
		mockLogger = {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			setContext: jest.fn(),
			serviceCall: jest.fn(),
		} as any

		filter = new ProblemDetailsFilter(mockLogger)

		mockRequest = createMockRequest({
			path: '/api/test',
			headers: { 'x-request-id': 'trace-123' },
		})
		mockResponse = createMockResponse()

		mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getRequest: jest.fn().mockReturnValue(mockRequest),
				getResponse: jest.fn().mockReturnValue(mockResponse),
			}),
			getArgs: jest.fn(),
			getArgByIndex: jest.fn(),
			switchToRpc: jest.fn(),
			switchToWs: jest.fn(),
			getType: jest.fn(),
		} as unknown as ArgumentsHost
	})

	describe('HttpException handling', () => {
		/**
		 * Requirement 7.1: WHEN testing ProblemDetailsFilter with HttpException
		 * THEN the test suite SHALL verify correct Problem Details structure
		 */
		it('should transform NotFoundException to Problem Details', () => {
			const exception = new NotFoundException('Resource not found')

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(404)
			expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json')
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.NotFound,
					title: expect.any(String),
					status: 404,
					detail: 'Resource not found',
					instance: '/api/test',
					traceId: 'trace-123',
				}),
			)
		})

		it('should transform ConflictException to Problem Details', () => {
			const exception = new ConflictException('Entity already exists')

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(409)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Conflict,
					status: 409,
					detail: 'Entity already exists',
				}),
			)
		})

		it('should transform ForbiddenException to Problem Details', () => {
			const exception = new ForbiddenException('Access denied')

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(403)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Forbidden,
					status: 403,
					detail: 'Access denied',
				}),
			)
		})

		it('should transform UnauthorizedException to Problem Details', () => {
			const exception = new UnauthorizedException('Invalid credentials')

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(401)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Unauthorized,
					status: 401,
					detail: 'Invalid credentials',
				}),
			)
		})

		it('should use custom i18nType when provided in exception response', () => {
			// For non-400 status codes, i18nType is extracted from the response
			const exception = new ConflictException({
				message: 'Entity already exists',
				i18nType: 'custom.conflict.type',
			})

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(409)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'custom.conflict.type',
					status: 409,
				}),
			)
		})

		it('should use _i18nType for 400 validation errors', () => {
			// For 400 status codes with object response, _i18nType is used
			const exception = new BadRequestException({
				message: 'Validation failed',
				_i18nType: 'custom.validation.type',
			})

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(400)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'custom.validation.type',
					status: 400,
				}),
			)
		})
	})

	describe('validation error handling', () => {
		/**
		 * Requirement 7.2: WHEN testing ProblemDetailsFilter with validation errors
		 * THEN the test suite SHALL verify invalidParams array is populated correctly
		 */
		it('should transform BadRequestException with _zodIssues to Problem Details with invalidParams', () => {
			const exception = new BadRequestException({
				message: 'Validation failed',
				_zodIssues: [
					{ path: ['name'], message: 'errors.validation.required', code: 'invalid_type' },
					{ path: ['email'], message: 'errors.validation.string.invalid_email', code: 'invalid_string' },
				],
			})

			filter.catch(exception, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(400)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 400,
					invalidParams: expect.arrayContaining([
						expect.objectContaining({ name: 'name', reason: 'errors.validation.required', in: 'body' }),
						expect.objectContaining({ name: 'email', reason: 'errors.validation.string.invalid_email', in: 'body' }),
					]),
				}),
			)
		})

		it('should handle nested path in validation errors', () => {
			const exception = new BadRequestException({
				message: 'Validation failed',
				_zodIssues: [
					{ path: ['address', 'city'], message: 'errors.validation.required', code: 'invalid_type' },
				],
			})

			filter.catch(exception, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					invalidParams: expect.arrayContaining([
						expect.objectContaining({ name: 'address.city' }),
					]),
				}),
			)
		})

		it('should include _i18nType in validation error response', () => {
			const exception = new BadRequestException({
				message: 'Validation failed',
				_zodIssues: [{ path: ['field'], message: 'error', code: 'custom' }],
				_i18nType: 'agent.state.validation',
			})

			filter.catch(exception, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'agent.state.validation',
					status: 400,
				}),
			)
		})
	})

	describe('QueryFailedError handling', () => {
		/**
		 * Requirement 7.3: WHEN testing ProblemDetailsFilter with QueryFailedError
		 * THEN the test suite SHALL verify database errors are transformed to appropriate HTTP responses
		 */
		it('should transform unique violation to ConflictException Problem Details', () => {
			const queryError = new QueryFailedError('INSERT INTO...', [], new Error('duplicate key'))
			;(queryError as any).code = '23505'
			;(queryError as any).constraint = 'states_code_key'
			;(queryError as any).detail = 'Key (code)=(CA) already exists.'

			filter.catch(queryError, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(409)
			expect(mockLogger.error).toHaveBeenCalled()
		})

		it('should transform foreign key violation to BadRequestException Problem Details', () => {
			const queryError = new QueryFailedError('INSERT INTO...', [], new Error('foreign key'))
			;(queryError as any).code = '23503'
			;(queryError as any).constraint = 'states_region_id_fkey'

			filter.catch(queryError, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(400)
			expect(mockLogger.error).toHaveBeenCalled()
		})

		it('should transform not null violation to BadRequestException Problem Details', () => {
			const queryError = new QueryFailedError('INSERT INTO...', [], new Error('not null'))
			;(queryError as any).code = '23502'

			filter.catch(queryError, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(400)
		})

		it('should transform unknown database error to Internal Server Error', () => {
			const queryError = new QueryFailedError('SELECT...', [], new Error('connection failed'))
			;(queryError as any).code = 'ECONNREFUSED'

			filter.catch(queryError, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Internal,
					status: 500,
				}),
			)
		})
	})

	describe('ZodError handling', () => {
		/**
		 * Requirement 7.4: WHEN testing ProblemDetailsFilter with ZodError
		 * THEN the test suite SHALL verify validation errors are formatted correctly
		 */
		it('should transform ZodError to Problem Details with invalidParams', () => {
			const zodError = new ZodError([
				{
					code: 'invalid_type',
					expected: 'string',
					received: 'number',
					path: ['name'],
					message: 'Expected string, received number',
				} as ZodIssue,
			])

			filter.catch(zodError, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(400)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Validation,
					status: 400,
					invalidParams: expect.arrayContaining([
						expect.objectContaining({
							name: 'name',
							reason: 'Expected string, received number',
							in: 'body',
						}),
					]),
				}),
			)
		})

		it('should handle ZodError with multiple issues', () => {
			const zodError = new ZodError([
				{
					code: 'invalid_type',
					expected: 'string',
					received: 'undefined',
					path: ['firstName'],
					message: 'Required',
				} as ZodIssue,
				{
					code: 'invalid_string',
					validation: 'email',
					path: ['email'],
					message: 'Invalid email',
				} as ZodIssue,
			])

			filter.catch(zodError, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					invalidParams: expect.arrayContaining([
						expect.objectContaining({ name: 'firstName' }),
						expect.objectContaining({ name: 'email' }),
					]),
				}),
			)
		})

		it('should handle ZodError with empty path', () => {
			const zodError = new ZodError([
				{
					code: 'custom',
					path: [],
					message: 'Invalid request body',
				} as ZodIssue,
			])

			filter.catch(zodError, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					invalidParams: expect.arrayContaining([
						expect.objectContaining({ name: 'request' }),
					]),
				}),
			)
		})

		it('should handle ZodError with missing message using code-based fallback', () => {
			const zodError = new ZodError([
				{
					code: 'invalid_type',
					expected: 'string',
					received: 'number',
					path: ['name'],
					message: '', // Empty message
				} as ZodIssue,
			])

			filter.catch(zodError, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					invalidParams: expect.arrayContaining([
						expect.objectContaining({
							name: 'name',
							reason: expect.stringContaining('invalid_type'), // Should use code-based fallback
						}),
					]),
				}),
			)
		})

		it('should handle ZodError with undefined message using generic fallback', () => {
			const zodError = new ZodError([
				{
					code: 'custom',
					path: ['field'],
					message: undefined as any, // Undefined message
				} as ZodIssue,
			])

			filter.catch(zodError, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					invalidParams: expect.arrayContaining([
						expect.objectContaining({
							name: 'field',
							reason: expect.any(String), // Should have a reason (generic fallback)
						}),
					]),
				}),
			)
		})
	})

	describe('generic Error handling', () => {
		/**
		 * Requirement 7.5: WHEN testing ProblemDetailsFilter with generic Error
		 * THEN the test suite SHALL verify 500 Internal Server Error response
		 */
		it('should transform generic Error to Internal Server Error Problem Details', () => {
			const error = new Error('Something went wrong')

			filter.catch(error, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Internal,
					title: expect.any(String),
					status: 500,
					detail: 'Something went wrong',
					instance: '/api/test',
				}),
			)
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Unexpected error',
				expect.objectContaining({
					error: 'Something went wrong',
					stack: expect.any(String),
				}),
			)
		})

		it('should handle Error with empty message', () => {
			const error = new Error('')

			filter.catch(error, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Internal,
					status: 500,
				}),
			)
		})
	})

	describe('unknown error type handling', () => {
		it('should handle non-Error thrown values', () => {
			filter.catch('string error', mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					type: ProblemTypes.Internal,
					status: 500,
					detail: 'An unexpected error occurred',
				}),
			)
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Unknown error type',
				expect.objectContaining({
					error: 'string error',
				}),
			)
		})

		it('should handle null thrown value', () => {
			filter.catch(null, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(500)
		})

		it('should handle undefined thrown value', () => {
			filter.catch(undefined, mockHost)

			expect(mockResponse.status).toHaveBeenCalledWith(500)
		})
	})

	describe('response format', () => {
		it('should set Content-Type header to application/problem+json', () => {
			const exception = new NotFoundException('Not found')

			filter.catch(exception, mockHost)

			expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json')
		})

		it('should include instance from request path', () => {
			mockRequest.path = '/api/states/123'
			const exception = new NotFoundException('State not found')

			filter.catch(exception, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					instance: '/api/states/123',
				}),
			)
		})

		it('should include traceId from x-request-id header', () => {
			mockRequest.headers['x-request-id'] = 'custom-trace-id'
			const exception = new BadRequestException('Bad request')

			filter.catch(exception, mockHost)

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					traceId: 'custom-trace-id',
				}),
			)
		})
	})


	describe('Property 17: ProblemDetailsFilter Exception Transformation', () => {
		/**
		 * **Feature: agent-service-coverage, Property 17: ProblemDetailsFilter Exception Transformation**
		 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
		 *
		 * *For any* HttpException, the filter SHALL produce a Problem Details response
		 * with correct type, title, status, detail, and instance fields.
		 */
		it('should produce valid Problem Details for any HttpException status code', () => {
			fc.assert(
				fc.property(
					fc.constantFrom(400, 401, 403, 404, 409, 429, 500, 502, 504),
					fc.string({ minLength: 1, maxLength: 200 }),
					fc.string({ minLength: 1, maxLength: 100 }).map((s) => '/' + s.replace(/[^a-zA-Z0-9/]/g, '')),
					(statusCode, message, path) => {
						// Reset mocks for each property test iteration
						mockResponse = createMockResponse()
						mockRequest = createMockRequest({ path, headers: { 'x-request-id': 'trace-id' } })
						mockHost = {
							switchToHttp: jest.fn().mockReturnValue({
								getRequest: jest.fn().mockReturnValue(mockRequest),
								getResponse: jest.fn().mockReturnValue(mockResponse),
							}),
							getArgs: jest.fn(),
							getArgByIndex: jest.fn(),
							switchToRpc: jest.fn(),
							switchToWs: jest.fn(),
							getType: jest.fn(),
						} as unknown as ArgumentsHost

						const exception = new HttpException(message, statusCode)

						filter.catch(exception, mockHost)

						// Property: Response status matches exception status
						expect(mockResponse.status).toHaveBeenCalledWith(statusCode)

						// Property: Content-Type is always application/problem+json
						expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json')

						// Property: Response body has required Problem Details fields
						const responseBody = mockResponse.json.mock.calls[0][0]
						expect(responseBody).toHaveProperty('type')
						expect(responseBody).toHaveProperty('title')
						expect(responseBody).toHaveProperty('status', statusCode)
						expect(responseBody).toHaveProperty('instance', path)

						// Property: type is a valid URI or problem type
						expect(typeof responseBody.type).toBe('string')
						expect(responseBody.type.length).toBeGreaterThan(0)

						// Property: title is a non-empty string
						expect(typeof responseBody.title).toBe('string')
						expect(responseBody.title.length).toBeGreaterThan(0)
					},
				),
				{ numRuns: 100 },
			)
		})

		it('should always include invalidParams for validation errors with _zodIssues', () => {
			fc.assert(
				fc.property(
					fc.array(
						fc.record({
							path: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
							message: fc.string({ minLength: 1, maxLength: 100 }),
							code: fc.constantFrom('invalid_type', 'invalid_string', 'too_small', 'too_big', 'custom'),
						}),
						{ minLength: 1, maxLength: 5 },
					),
					(zodIssues) => {
						mockResponse = createMockResponse()
						mockHost = {
							switchToHttp: jest.fn().mockReturnValue({
								getRequest: jest.fn().mockReturnValue(mockRequest),
								getResponse: jest.fn().mockReturnValue(mockResponse),
							}),
							getArgs: jest.fn(),
							getArgByIndex: jest.fn(),
							switchToRpc: jest.fn(),
							switchToWs: jest.fn(),
							getType: jest.fn(),
						} as unknown as ArgumentsHost

						const exception = new BadRequestException({
							message: 'Validation failed',
							_zodIssues: zodIssues,
						})

						filter.catch(exception, mockHost)

						// Property: Response status is 400 for validation errors
						expect(mockResponse.status).toHaveBeenCalledWith(400)

						// Property: invalidParams array has same length as zodIssues
						const responseBody = mockResponse.json.mock.calls[0][0]
						expect(responseBody.invalidParams).toBeDefined()
						expect(responseBody.invalidParams.length).toBe(zodIssues.length)

						// Property: Each invalidParam has required fields
						responseBody.invalidParams.forEach((param: any, index: number) => {
							expect(param).toHaveProperty('name')
							expect(param).toHaveProperty('reason')
							expect(param).toHaveProperty('in', 'body')
							expect(param.name).toBe(zodIssues[index].path.join('.'))
							expect(param.reason).toBe(zodIssues[index].message)
						})
					},
				),
				{ numRuns: 50 },
			)
		})
	})
})
