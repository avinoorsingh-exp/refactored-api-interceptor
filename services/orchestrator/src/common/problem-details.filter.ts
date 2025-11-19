import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common'
import { Request, Response } from 'express'
import { ZodError } from 'zod'
import { AxiosError, isAxiosError } from 'axios'
import {
	Problems,
	isProblemDetails,
	type ProblemDetails,
	type InvalidParam,
} from '@exprealty/shared-domain'
import { LoggerService } from '../core/logger.service.js'
import { UpstreamHttpError } from './ecs-http-client.js'

/**
 * Global exception filter that transforms all errors into RFC 9457 Problem Details.
 *
 * Handles:
 * - UpstreamHttpError (from HTTP client when provider calls fail)
 * - HttpException (NestJS built-in, including BadRequestException from validation)
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

		let problem: ProblemDetails

		// 1. Check if this is an AxiosError with attached Problem Details from our HTTP client
		if (
			typeof exception === 'object' &&
			exception !== null &&
			'upstreamProblem' in exception
		) {
			const err = exception as { upstreamProblem: ProblemDetails }
			problem = {
				...err.upstreamProblem,
				instance: instance || err.upstreamProblem.instance,
				traceId: traceId || err.upstreamProblem.traceId,
			}

			this.logger.warn('Upstream provider error (HttpClient)', {
				status: problem.status,
				type: problem.type,
				detail: problem.detail,
				traceId: problem.traceId,
			})
		}
		// 2. Handle UpstreamHttpError (if we ever use it directly)
		else if (exception instanceof UpstreamHttpError) {
			problem = {
				...exception.problem,
				instance: instance || exception.problem.instance,
				traceId: traceId || exception.problem.traceId,
			}

			this.logger.warn('Upstream provider error (wrapped)', {
				status: problem.status,
				type: problem.type,
				detail: problem.detail,
				traceId: problem.traceId,
			})
		}
		// 3. Handle AxiosError from provider services (property-provider, address-provider, etc.)
		else if (isAxiosError(exception)) {
			problem = this.handleAxiosError(exception as AxiosError, instance, traceId)
		}
		// 2. Handle NestJS HttpException (includes BadRequestException, NotFoundException, etc.)
		else if (exception instanceof HttpException) {
			const status = exception.getStatus()
			const exceptionResponse = exception.getResponse()

			// Check if it's a validation error (BadRequestException from ZodValidationPipe)
			if (status === 400 && typeof exceptionResponse === 'object') {
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

				problem = this.createProblemFromStatus(status, message, instance, traceId)
			}
		}
		// 3. Handle ZodError directly (shouldn't happen if validation pipe works, but just in case)
		else if (exception instanceof ZodError) {
			problem = this.handleZodError(exception, instance, traceId)
		}
		// 4. Handle generic Error (unexpected errors)
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
	 * Handle AxiosError from provider REST clients.
	 * Maps provider HTTP errors to Problem Details.
	 */
	private handleAxiosError(
		error: AxiosError,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const status = error.response?.status ?? 502
		const responseData = error.response?.data

		// If provider already returns Problem Details, use it
		if (isProblemDetails(responseData)) {
			this.logger.warn('Provider returned Problem Details', {
				status,
				type: responseData.type,
				detail: responseData.detail,
				traceId,
			})
			return {
				...responseData,
				instance: instance || responseData.instance,
				traceId: traceId || responseData.traceId,
			}
		}

		// Provider returned structured error (like property-provider's 404)
		const providerMessage =
			typeof responseData === 'object' && responseData !== null
				? (responseData as { message?: string; detail?: string }).message ||
					(responseData as { message?: string; detail?: string }).detail ||
					error.message
				: error.message

		// Map status to appropriate problem type
		this.logger.warn('Provider HTTP error', {
			status,
			message: providerMessage,
			url: error.config?.url,
			traceId,
		})

		return this.createProblemFromStatus(status, providerMessage, instance, traceId)
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
		const invalidParams: InvalidParam[] = []

		// Check if we have Zod issues array
		const zodIssues = exceptionResponse._zodIssues as Array<{
			path: (string | number)[]
			message: string
			code: string
		}> | undefined

		if (zodIssues && Array.isArray(zodIssues)) {
			// Convert Zod issues to InvalidParam format
			for (const issue of zodIssues) {
				invalidParams.push({
					name: issue.path.length > 0 ? issue.path.join('.') : 'request',
					reason: issue.message,
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

				// Recursively check nested properties
				for (const [key, value] of Object.entries(obj)) {
					if (key !== '_errors' && key !== '_zodIssues' && typeof value === 'object' && value !== null) {
						extractErrors(value as Record<string, unknown>, [...path, key])
					}
				}
			}

			extractErrors(exceptionResponse)
		}

		return Problems.validation(
			'The request body failed schema validation',
			invalidParams.length > 0 ? invalidParams : undefined,
			instance,
			traceId,
		)
	}

	/**
	 * Handle ZodError directly (convert to InvalidParam array)
	 */
	private handleZodError(
		error: ZodError,
		instance: string,
		traceId?: string,
	): ProblemDetails {
		const invalidParams: InvalidParam[] = error.issues.map((issue) => ({
			name: issue.path.join('.') || 'request',
			reason: issue.message,
			in: 'body',
		}))

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
	): ProblemDetails {
		// Use explicit if-else instead of switch to avoid enum comparison issues
		if (status === 400) {
			return Problems.validation(detail, undefined, instance, traceId)
		} else if (status === 401) {
			return Problems.unauthorized(detail, instance, traceId)
		} else if (status === 403) {
			return Problems.forbidden(detail, instance, traceId)
		} else if (status === 404) {
			return Problems.notFound(detail, instance, traceId)
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
}
