import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	ApiRequestLogEntity,
	ApiActorEntity,
} from '@exprealty/database';
import {
	HttpMethod,
	ApiErrorClassification,
	ApiActorType,
	type ApiRequestMetadata,
} from '@exprealty/shared-domain';
import { ApiRequestContextService } from './api-request-context.service.js';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';

/**
 * Service for logging API requests and errors.
 * 
 * Handles high-volume, non-blocking request logging with:
 * - Async/background processing to avoid blocking requests
 * - Error classification and PII-safe logging
 * - Stack trace capture only for server errors
 * 
 * @public
 */
@Injectable()
export class ApiMonitoringService {
	private readonly logger: IApiMonitoringLogger;
	private readonly enabled: boolean;
	private readonly sampleRate: number;

	constructor(
		@InjectRepository(ApiRequestLogEntity)
		private readonly requestLogRepo: Repository<ApiRequestLogEntity>,
		@InjectRepository(ApiActorEntity)
		private readonly actorRepo: Repository<ApiActorEntity>,
		private readonly contextService: ApiRequestContextService,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiMonitoringService');
		// Feature flags from environment
		this.enabled = process.env.API_MONITORING_ENABLED !== 'false';
		this.sampleRate = parseFloat(process.env.API_MONITORING_SAMPLE_RATE || '1.0');
		// Verify logger is working by logging startup
		this.logger.info('ApiMonitoringService initialized successfully', {
			enabled: this.enabled,
			sampleRate: this.sampleRate,
		});
	}

	/**
	 * Log an API request asynchronously.
	 * 
	 * This method is non-blocking and will not throw errors that could
	 * affect the request lifecycle. Errors are logged but not propagated.
	 * 
	 * @param metadata - Request metadata to log
	 */
	async logRequest(metadata: ApiRequestMetadata): Promise<void> {
		if (!this.enabled) {
			return;
		}

		// Sampling: skip some requests if sample rate < 1.0
		if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
			return;
		}

		try {
			const log = this.requestLogRepo.create({
				route: metadata.route,
				method: metadata.method,
				statusCode: metadata.statusCode,
				latencyMs: metadata.latencyMs,
				requestSizeBytes: metadata.requestSizeBytes,
				responseSizeBytes: metadata.responseSizeBytes,
				ipAddress: metadata.ipAddress,
				userAgent: metadata.userAgent,
				correlationId: metadata.correlationId,
				timestamp: metadata.timestamp,
				actorId: metadata.actorId,
				actorType: metadata.actorType,
				hasError: metadata.hasError,
				errorClassification: metadata.errorClassification,
				errorMessage: metadata.errorMessage,
				stackTrace: metadata.stackTrace,
			});

			// Use save() with catch to ensure non-blocking
			await this.requestLogRepo.save(log).catch((error) => {
				// Log error but don't throw - monitoring should never break requests
				this.logger.error('Failed to save API request log', {
					correlationId: metadata.correlationId,
					route: metadata.route,
					error: error instanceof Error ? error.message : String(error),
				});
			});
		} catch (error) {
			// Catch any unexpected errors
			this.logger.error('Unexpected error in API monitoring', {
				correlationId: metadata.correlationId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Classify an error based on status code and error type.
	 */
	classifyError(
		statusCode: number,
		error?: Error,
	): ApiErrorClassification {
		if (statusCode >= 500) {
			return ApiErrorClassification.SERVER_ERROR;
		}

		if (statusCode === 401 || statusCode === 403) {
			return ApiErrorClassification.AUTH_ERROR;
		}

		if (statusCode === 429) {
			return ApiErrorClassification.RATE_LIMIT_ERROR;
		}

		if (statusCode >= 400) {
			// Check if it's a validation error
			if (error?.name === 'ValidationError' || error?.name === 'BadRequestException') {
				return ApiErrorClassification.VALIDATION_ERROR;
			}
			return ApiErrorClassification.CLIENT_ERROR;
		}

		return ApiErrorClassification.UNKNOWN_ERROR;
	}

	/**
	 * Sanitize error message to remove PII.
	 * 
	 * Removes potential PII like emails, phone numbers, SSNs, etc.
	 */
	sanitizeErrorMessage(message: string): string {
		// Remove email addresses
		let sanitized = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

		// Remove phone numbers (US format)
		sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

		// Remove SSNs
		sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

		// Remove credit card numbers
		sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

		return sanitized;
	}

	/**
	 * Extract stack trace from error (only for server errors).
	 */
	extractStackTrace(error: Error | unknown, statusCode: number): string | undefined {
		// Only capture stack traces for server errors (5xx)
		if (statusCode < 500) {
			return undefined;
		}

		if (error instanceof Error && error.stack) {
			return error.stack;
		}

		return undefined;
	}

	/**
	 * Get request metadata from context and Express request/response.
	 */
	buildRequestMetadata(
		route: string,
		method: HttpMethod,
		statusCode: number,
		latencyMs: number,
		ipAddress?: string,
		userAgent?: string,
		error?: Error | unknown,
		requestSizeBytes?: number,
		responseSizeBytes?: number,
	): ApiRequestMetadata {
		const context = this.contextService.getContext();
		const correlationId = context?.correlationId || 'unknown';
		const timestamp = context?.timestamp ? new Date(context.timestamp) : new Date();

		const hasError = statusCode >= 400;
		const errorClassification = hasError
			? this.classifyError(statusCode, error instanceof Error ? error : undefined)
			: undefined;

		const errorMessage = error instanceof Error
			? this.sanitizeErrorMessage(error.message)
			: undefined;

		const stackTrace = this.extractStackTrace(error, statusCode);

		return {
			route,
			method,
			statusCode,
			latencyMs,
			requestSizeBytes,
			responseSizeBytes,
			ipAddress,
			userAgent,
			correlationId,
			timestamp,
			actorId: context?.actorId,
			actorType: context?.actorType,
			errorClassification,
			hasError,
			errorMessage,
			stackTrace,
		};
	}
}

