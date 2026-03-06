import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common'
import { Request, Response } from 'express'
import { ZodError } from 'zod'
import { QueryFailedError } from 'typeorm'
import {
	Problems,
	type ProblemDetails,
	type InvalidParam,
} from '@exprealty/shared-domain'
import { LoggerService } from '../core/logger.service.js'
import { DatabaseErrorHandler } from '../errors/database-error.handler.js'
import { DomainException } from './exceptions/domain.exception.js'
import { SearchValidationException } from './exceptions/search-validation.exception.js'
import { FilterValidationException } from './exceptions/filter-validation.exception.js'
import { QueryFieldValidationException } from './exceptions/query-field-validation.exception.js'

/**
 * Global exception filter that transforms all errors into RFC 9457 Problem Details.
 *
 * Handles:
 * - HttpException (NestJS built-in, including ConflictException, BadRequestException from validation)
 * - ZodError (validation errors)
 * - Generic Error (unexpected errors)
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
	constructor(private readonly logger: LoggerService) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp()
		const response = ctx.getResponse<Response>()
		const request = ctx.getRequest<Request>()

		const traceId = request.headers['x-request-id'] as string | undefined
		const instance = request.path

		// DEBUG: Log the exception to identify validation source
		if (instance.includes('/retry')) {
			this.logger.error('Exception caught for retry endpoint', {
				exceptionType: exception?.constructor?.name,
				exceptionMessage: exception instanceof Error ? exception.message : String(exception),
				exceptionStack: exception instanceof Error ? exception.stack : undefined,
				isHttpException: exception instanceof HttpException,
				httpStatus: exception instanceof HttpException ? exception.getStatus() : undefined,
				httpResponse: exception instanceof HttpException ? exception.getResponse() : undefined,
				path: instance,
				method: request.method,
			})
		}

		let problem: ProblemDetails

		// 1. Handle DomainException FIRST (before HttpException check since DomainException extends HttpException)
		// This ensures SearchValidationException, FilterValidationException, etc. are handled with full i18n support
		if (exception instanceof DomainException) {
			problem = this.handleDomainException(exception, instance, traceId)
		}
		// 2. Handle TypeORM QueryFailedError (database constraint violations)
		else if (exception instanceof QueryFailedError) {
			const dbError = exception as any;
			
			// Log the database error
			this.logger.error('Database error occurred', {
				code: dbError.code,
				constraint: dbError.constraint,
				table: dbError.table,
				detail: dbError.detail,
				traceId,
			});

			// Transform to HTTP exception if it's a known constraint violation
			if (DatabaseErrorHandler.isDatabaseError(dbError)) {
				const httpException = DatabaseErrorHandler.toHttpException(dbError);
				
				if (httpException instanceof HttpException) {
					const status = httpException.getStatus();
					const exceptionResponse = httpException.getResponse();
					const message = typeof exceptionResponse === 'object' && 'message' in exceptionResponse
						? String(exceptionResponse.message)
						: 'Database constraint violation';
					
					problem = this.createProblemFromStatus(status, message, instance, traceId);
				} else {
					// Unknown database error
					problem = Problems.internal(
						exception.message || 'Database error occurred',
						instance,
						traceId,
					);
				}
			} else {
				// Unknown database error
				problem = Problems.internal(
					exception.message || 'Database error occurred',
					instance,
					traceId,
				);
			}
		}
		// 3. Handle ZodError directly (shouldn't happen if validation pipe works, but just in case)
		else if (exception instanceof ZodError) {
			problem = this.handleZodError(exception, instance, traceId)
		}
		// 4. Handle NestJS HttpException (includes ConflictException, BadRequestException, NotFoundException, etc.)
		else if (exception instanceof HttpException) {
			const status = exception.getStatus()
			const exceptionResponse = exception.getResponse()

			// DEBUG: Log all 400 errors to identify validation source
			if (status === 400 && instance.includes('/retry')) {
				console.error('[ProblemDetailsFilter] BadRequestException caught for retry endpoint', {
					status,
					exceptionResponse: JSON.stringify(exceptionResponse, null, 2),
					exceptionResponseType: typeof exceptionResponse,
					hasZodIssues: typeof exceptionResponse === 'object' && exceptionResponse !== null && '_zodIssues' in (exceptionResponse as Record<string, unknown>),
					exceptionMessage: exception.message,
					exceptionName: exception.constructor.name,
					stack: exception.stack,
					path: instance,
					exceptionKeys: typeof exceptionResponse === 'object' && exceptionResponse !== null ? Object.keys(exceptionResponse as Record<string, unknown>) : [],
				})
				this.logger.error('BadRequestException caught for retry endpoint', {
					status,
					exceptionResponse,
					exceptionResponseType: typeof exceptionResponse,
					hasZodIssues: typeof exceptionResponse === 'object' && exceptionResponse !== null && '_zodIssues' in (exceptionResponse as Record<string, unknown>),
					exceptionMessage: exception.message,
					exceptionName: exception.constructor.name,
					stack: exception.stack,
					path: instance,
				})
			}

			// Check if it's a validation error (BadRequestException from ZodValidationPipe)
			// ONLY call handleValidationError if the exception response has actual validation error fields
			// (_zodIssues or _errors), not just a generic message
			const hasValidationErrors = typeof exceptionResponse === 'object' && exceptionResponse !== null && (
				'_zodIssues' in (exceptionResponse as Record<string, unknown>) ||
				'_errors' in (exceptionResponse as Record<string, unknown>)
			)
			
			if (status === 400 && typeof exceptionResponse === 'object' && hasValidationErrors) {
				problem = this.handleValidationError(
					exceptionResponse as Record<string, unknown>,
					instance,
					traceId,
				)
			} else {
				// Generic HTTP exception
				const message =
					typeof exceptionResponse === 'string'
						? exceptionResponse
						: (exceptionResponse as { message?: string } | undefined)?.message ||
							exception.message

				// Extract custom i18n type if provided
				const i18nType =
					typeof exceptionResponse === 'object' && exceptionResponse !== null
						? (exceptionResponse as { i18nType?: string }).i18nType
						: undefined

				problem = this.createProblemFromStatus(status, message, instance, traceId, i18nType)
			}
		}
		
		// 5. Handle generic Error (unexpected errors)
		else if (exception instanceof Error) {
			problem = Problems.internal(
				exception.message || 'An unexpected error occurred',
				instance,
				traceId,
			)

			this.logger.error('Unexpected error', {
				error: exception.message,
				stack: exception.stack,
				traceId,
			})
		}
		// 5. Handle unknown non-Error types
		else {
			problem = Problems.internal('An unexpected error occurred', instance, traceId)

			this.logger.error('Unknown error type', {
				error: String(exception),
				traceId,
			})
		}

		// Return RFC 9457 Problem Details response
		response
			.status(problem.status)
			.header('Content-Type', 'application/problem+json')
			.json(problem)
	}

	/**
	 * Handle validation errors from ZodValidationPipe.
	 * The pipe returns Zod's issues array with optional _i18nType.
	 */
	private handleValidationError(
		exceptionResponse: Record<string, unknown>,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		// DEBUG: Log the exception response to identify the source
		if (instance.includes('/retry')) {
			console.error('[handleValidationError] Exception response for retry endpoint:', JSON.stringify(exceptionResponse, null, 2))
			console.error('[handleValidationError] Exception response keys:', Object.keys(exceptionResponse))
			this.logger.error('handleValidationError called for retry endpoint', {
				exceptionResponse,
				exceptionResponseKeys: Object.keys(exceptionResponse),
				instance,
				traceId,
			})
		}

		const invalidParams: InvalidParam[] = []
		
		// Extract custom i18n type if provided (e.g., 'agent.country.validation')
		const i18nType = exceptionResponse._i18nType as string | undefined

		// Check if we have Zod issues array
		const zodIssues = exceptionResponse._zodIssues as Array<{
			path: (string | number)[]
			message: string
			code: string
		}> | undefined

		if (zodIssues && Array.isArray(zodIssues)) {
			// Convert Zod issues to InvalidParam format
			for (const issue of zodIssues) {
				// Ensure message is always present - use fallback if missing
				const errorMessage = issue.message || 
					(issue.code ? `Validation failed for ${issue.code}` : 'Validation failed') ||
					'Invalid value';
				
				invalidParams.push({
					name: issue.path.length > 0 ? issue.path.join('.') : 'request',
					reason: errorMessage,
					in: 'body',
				})
			}
		} else {
			// Fallback: extract from Zod's format() structure (legacy support)
			const extractErrors = (obj: Record<string, unknown>, path: string[] = []): void => {
				if (typeof obj !== 'object') return

				// Check for _errors array at this level
				const errors = obj._errors as unknown[] | undefined
				if (Array.isArray(errors) && errors.length > 0) {
					for (const error of errors) {
						invalidParams.push({
							name: path.join('.') || 'request',
							reason: String(error),
							in: 'body',
						})
					}
				}

				// Recursively check nested properties (skip internal fields)
				for (const [key, value] of Object.entries(obj)) {
					if (key !== '_errors' && key !== '_i18nType' && key !== '_zodIssues' && typeof value === 'object' && value !== null) {
						extractErrors(value as Record<string, unknown>, [...path, key])
					}
				}
			}

			extractErrors(exceptionResponse)
		}

		// If i18nType is provided, use it; otherwise use default validation type
		if (i18nType) {
			return {
				type: i18nType,
				title: 'Validation Failed',
				status: 400,
				detail: 'The request body failed schema validation',
				instance,
				traceId,
				invalidParams: invalidParams.length > 0 ? invalidParams : undefined,
			}
		}

		return Problems.validation(
			'The request body failed schema validation',
			invalidParams.length > 0 ? invalidParams : undefined,
			instance,
			traceId,
		)
	}

	/**
	 * Handle domain exceptions (SearchValidationException, FilterValidationException, etc.)
	 * Formats them as RFC 9457 Problem Details with i18n support.
	 */
	private handleDomainException(
		exception: DomainException,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const status = exception.getStatus()
		const context = exception.getContext()
		const i18nType = exception.getI18nType()
		const message = exception.message

		// Log domain exceptions at WARN level (client errors)
		this.logger.warn(`Domain exception: ${message}`, {
			i18nType,
			context,
			instance,
			traceId,
		})

		// Handle SearchValidationException specifically
		if (exception instanceof SearchValidationException) {
			return this.handleSearchValidationException(exception, instance, traceId)
		}

		// Handle FilterValidationException specifically
		if (exception instanceof FilterValidationException) {
			return this.handleFilterValidationException(exception, instance, traceId)
		}

		// Handle QueryFieldValidationException specifically
		if (exception instanceof QueryFieldValidationException) {
			return this.handleQueryFieldValidationException(exception, instance, traceId)
		}

		// Generic domain exception handling
		const invalidParams: InvalidParam[] = []
		if (context.field) {
			invalidParams.push({
				name: context.field,
				reason: message,
				in: 'query',
			})
		}

		// Use i18n type if provided, otherwise use standard problem type
		if (i18nType) {
			return {
				type: i18nType,
				title: 'Domain Validation Error',
				status,
				detail: message,
				instance,
				traceId,
				invalidParams: invalidParams.length > 0 ? invalidParams : undefined,
				...context,
			}
		}

		return Problems.validation(
			message,
			invalidParams.length > 0 ? invalidParams : undefined,
			instance,
			traceId,
		)
	}

	/**
	 * Handle SearchValidationException with full context.
	 * Includes field, search term, validation constraints, and hints.
	 */
	private handleSearchValidationException(
		exception: SearchValidationException,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const { field, searchTerm, validationError, validation, i18nType } = exception

		// Build hint based on validation constraints
		let hint = 'Check field validation rules in metadata endpoint'
		if (validation) {
			if (validation.min !== undefined && validation.max !== undefined) {
				hint = `Value must be between ${validation.min} and ${validation.max}`
			} else if (validation.min !== undefined) {
				hint = `Value must be at least ${validation.min}`
			} else if (validation.max !== undefined) {
				hint = `Value must be at most ${validation.max}`
			} else if (validation.enum) {
				hint = `Value must be one of: ${validation.enum.join(', ')}`
			}
		}

		return {
			type: i18nType,
			title: 'Search Validation Error',
			status: 400,
			detail: validationError,
			instance,
			traceId,
			invalidParams: [{
				name: field,
				reason: validationError,
				in: 'query',
			}],
			field,
			searchTerm,
			validation,
			hint,
		}
	}

	/**
	 * Handle FilterValidationException with full context.
	 * Includes field, operator, value, and hints.
	 */
	private handleFilterValidationException(
		exception: FilterValidationException,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const { field, operator, value, validationError, i18nType } = exception

		return {
			type: i18nType,
			title: 'Filter Validation Error',
			status: 400,
			detail: validationError,
			instance,
			traceId,
			invalidParams: [{
				name: field,
				reason: validationError,
				in: 'query',
			}],
			field,
			operator,
			value,
			hint: 'Check allowed operators and field types in metadata endpoint',
		}
	}

	/**
	 * Handle QueryFieldValidationException with full context.
	 * Includes operation type, invalid fields, and allowed fields.
	 */
	private handleQueryFieldValidationException(
		exception: QueryFieldValidationException,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const { operationType, invalidFields, allowedFields, i18nType } = exception

		// Build invalid params for each invalid field
		const invalidParams: InvalidParam[] = invalidFields.map((field) => ({
			name: field,
			reason: `Field '${field}' is not allowed for ${operationType}`,
			in: 'query',
		}))

		return {
			type: i18nType,
			title: `Invalid ${operationType.charAt(0).toUpperCase() + operationType.slice(1)} Field`,
			status: 400,
			detail: exception.message,
			instance,
			traceId,
			invalidParams,
			operationType,
			invalidFields,
			allowedFields,
			hint: 'Check allowed fields in metadata endpoint',
		}
	}

	/**
	 * Handle ZodError directly (convert to InvalidParam array)
	 */
	private handleZodError(
		error: ZodError,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const invalidParams: InvalidParam[] = error.issues.map((issue) => {
			// Ensure message is always present - use fallback if missing
			const errorMessage = issue.message || 
				(issue.code ? `Validation failed for ${issue.code}` : 'Validation failed') ||
				'Invalid value';
			
			return {
				name: issue.path.join('.') || 'request',
				reason: errorMessage,
				in: 'body',
			};
		})

		return Problems.validation(
			'The request body failed schema validation',
			invalidParams,
			instance,
			traceId,
		)
	}

	/**
	 * Create a Problem Details object from HTTP status code
	 */
	private createProblemFromStatus(
		status: number,
		detail: string,
		instance: string,
		traceId?: string,
		i18nType?: string,
	): ProblemDetails {
		// If custom i18n type is provided, use it
		if (i18nType) {
			return {
				type: i18nType,
				title: this.getTitleForStatus(status),
				status,
				detail,
				instance,
				traceId,
			}
		}

		// Use explicit if-else instead of switch to avoid enum comparison issues
		if (status === 400) {
			return Problems.validation(detail, undefined, instance, traceId)
		} else if (status === 401) {
			return Problems.unauthorized(detail, instance, traceId)
		} else if (status === 403) {
			return Problems.forbidden(detail, instance, traceId)
		} else if (status === 404) {
			return Problems.notFound(detail, instance, traceId)
		} else if (status === 409) {
			return Problems.conflict(detail, instance, traceId)
		} else if (status === 429) {
			return Problems.rateLimited(detail, instance, traceId)
		} else if (status === 502) {
			return Problems.badGateway(detail, instance, traceId)
		} else if (status === 504) {
			return Problems.timeout(detail, instance, traceId)
		} else {
			return Problems.internal(detail, instance, traceId)
		}
	}

	/**
	 * Get human-readable title for HTTP status code
	 */
	private getTitleForStatus(status: number): string {
		switch (status) {
			case 400:
				return 'Bad Request'
			case 401:
				return 'Unauthorized'
			case 403:
				return 'Forbidden'
			case 404:
				return 'Not Found'
			case 409:
				return 'Conflict'
			case 429:
				return 'Too Many Requests'
			case 502:
				return 'Bad Gateway'
			case 504:
				return 'Gateway Timeout'
			default:
				return 'Internal Server Error'
		}
	}
}
