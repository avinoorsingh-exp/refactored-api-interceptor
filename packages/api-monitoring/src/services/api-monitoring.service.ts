import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { API_MONITORING_REQUEST_LOG_REPO } from '../tokens/repository.tokens.js';
import {
	HttpMethod,
	ApiErrorClassification,
	type ApiRequestMetadata,
} from '../domain/api-monitoring.types.js';
import { ApiRequestContextService } from './api-request-context.service.js';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';

/**
 * Service for logging API requests and errors.
 * @public
 */
@Injectable()
export class ApiMonitoringService {
	private readonly logger: IApiMonitoringLogger;
	private readonly enabled: boolean;
	private readonly sampleRate: number;

	constructor(
		@Inject(API_MONITORING_REQUEST_LOG_REPO)
		private readonly requestLogRepo: Repository<Record<string, unknown>>,
		private readonly contextService: ApiRequestContextService,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiMonitoringService');
		this.enabled = process.env.API_MONITORING_ENABLED !== 'false';
		this.sampleRate = parseFloat(process.env.API_MONITORING_SAMPLE_RATE || '1.0');
		this.logger.info('ApiMonitoringService initialized successfully', {
			enabled: this.enabled,
			sampleRate: this.sampleRate,
		});
	}

	async logRequest(metadata: ApiRequestMetadata): Promise<void> {
		if (!this.enabled) {
			return;
		}

		if (!metadata.actorId) {
			if (process.env.NODE_ENV !== 'production') {
				this.logger.debug('Skipping API request log - no actor ID', {
					route: metadata.route,
					method: metadata.method,
					correlationId: metadata.correlationId,
				});
			}
			return;
		}

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
				requestBodySnapshot: metadata.requestBodySnapshot,
			} as Record<string, unknown>);

			await this.requestLogRepo.save(log).catch((err: unknown) => {
				this.logger.error('Failed to save API request log', {
					correlationId: metadata.correlationId,
					route: metadata.route,
					error: err instanceof Error ? err.message : String(err),
				});
			});
		} catch (err: unknown) {
			this.logger.error('Unexpected error in API monitoring', {
				correlationId: metadata.correlationId,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	classifyError(statusCode: number, error?: Error): ApiErrorClassification {
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
			if (error?.name === 'ValidationError' || error?.name === 'BadRequestException') {
				return ApiErrorClassification.VALIDATION_ERROR;
			}
			return ApiErrorClassification.CLIENT_ERROR;
		}

		return ApiErrorClassification.UNKNOWN_ERROR;
	}

	sanitizeErrorMessage(message: string): string {
		let sanitized = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
		sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
		sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
		sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
		return sanitized;
	}

	extractStackTrace(error: unknown, statusCode: number): string | undefined {
		if (statusCode < 500) {
			return undefined;
		}

		if (error instanceof Error && error.stack) {
			return error.stack;
		}

		return undefined;
	}

	buildRequestMetadata(
		route: string,
		method: HttpMethod,
		statusCode: number,
		latencyMs: number,
		ipAddress?: string,
		userAgent?: string,
		error?: unknown,
		requestSizeBytes?: number,
		responseSizeBytes?: number,
		requestBodySnapshot?: string,
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
			requestBodySnapshot,
		};
	}
}
