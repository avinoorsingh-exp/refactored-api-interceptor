import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { API_MONITORING_REQUEST_LOG_REPO } from '../tokens/repository.tokens.js';
import {
	HttpMethod,
	ApiErrorClassification,
	type ApiRequestMetadata,
} from '../domain/api-monitoring.types.js';
import type { ApiRequestLogOutcome } from '../domain/api-request-log-outcome.js';
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

	/** Persists `api_request_log` when enabled; returns why skipped or if DB failed. */
	async logRequest(metadata: ApiRequestMetadata): Promise<ApiRequestLogOutcome> {
		if (!this.enabled) {
			return {
				status: 'skipped',
				reason: 'monitoring_disabled',
				message:
					'Request log was not saved: API monitoring is disabled (set API_MONITORING_ENABLED to a value other than false to enable).',
			};
		}

		if (!metadata.actorId) {
			this.logger.warn('Request log not saved: actor id is required', {
				route: metadata.route,
				method: metadata.method,
				correlationId: metadata.correlationId,
			});
			return {
				status: 'skipped',
				reason: 'no_actor_id',
				message:
					'Request log was not saved: actor id is required. Register ApiActorMiddleware after authentication so each request has an actor in context.',
			};
		}

		if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
			return {
				status: 'skipped',
				reason: 'sampled',
				message: `Request log was not saved: random sampling excluded this request (API_MONITORING_SAMPLE_RATE=${this.sampleRate}).`,
			};
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
				monitoringUserId: metadata.monitoringUserId,
				sourceApplication: metadata.sourceApplication,
				retryCount: metadata.retryCount ?? 0,
			} as Record<string, unknown>);

			try {
				await this.requestLogRepo.save(log);
				return { status: 'saved' };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				this.logger.error('Failed to save API request log', {
					correlationId: metadata.correlationId,
					route: metadata.route,
					error: msg,
				});
				return {
					status: 'error',
					reason: 'save_failed',
					message: `Request log was not saved: database error (${msg}).`,
				};
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logger.error('Unexpected error in API monitoring', {
				correlationId: metadata.correlationId,
				error: msg,
			});
			return {
				status: 'error',
				reason: 'unexpected',
				message: `Request log was not saved: unexpected error (${msg}).`,
			};
		}
	}

	/** Maps HTTP status (+ optional error name) to stored classification enum. */
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

	/** Redacts PII patterns from error text before persistence. */
	sanitizeErrorMessage(message: string): string {
		let sanitized = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
		sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
		sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
		sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
		return sanitized;
	}

	/** Keeps stacks for server errors only. */
	extractStackTrace(error: unknown, statusCode: number): string | undefined {
		if (statusCode < 500) {
			return undefined;
		}

		if (error instanceof Error && error.stack) {
			return error.stack;
		}

		return undefined;
	}

	/** Merges HTTP facts + async context into one {@link ApiRequestMetadata} object. */
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
		sourceApplication?: string,
		retryCount = 0,
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
			monitoringUserId: context?.monitoringUserId,
			errorClassification,
			hasError,
			errorMessage,
			stackTrace,
			requestBodySnapshot,
			sourceApplication,
			retryCount,
		};
	}
}
