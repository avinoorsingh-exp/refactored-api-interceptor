import type { ApiRequestContextService } from '../services/api-request-context.service.js';
import { HttpMethod, ApiErrorClassification } from '../domain/api-interceptor.types.js';
import type { ApiExchangeSummary } from '../domain/api-exchange.event.js';

function classifyError(statusCode: number, error?: Error): ApiErrorClassification {
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

function sanitizeErrorMessage(message: string): string {
	let sanitized = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
	sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
	sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
	sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
	return sanitized;
}

function extractStackTrace(error: unknown, statusCode: number): string | undefined {
	if (statusCode < 500) {
		return undefined;
	}
	if (error instanceof Error && error.stack) {
		return error.stack;
	}
	return undefined;
}

/** Merges HTTP facts and async-local context into a single summary for {@link ApiExchangeEvent}. */
export function buildApiExchangeSummary(
	contextService: ApiRequestContextService,
	params: {
		route: string;
		method: HttpMethod;
		statusCode: number;
		latencyMs: number;
		ipAddress?: string;
		userAgent?: string;
		error?: unknown;
		requestSizeBytes?: number;
		responseSizeBytes?: number;
		sourceApplication?: string;
		retryCount: number;
	},
): ApiExchangeSummary {
	const context = contextService.getContext();
	const correlationId = context?.correlationId || contextService.getCorrelationId() || 'unknown';
	const timestamp =
		typeof context?.timestamp === 'number' && Number.isFinite(context.timestamp)
			? new Date(context.timestamp)
			: new Date();

	const hasError = params.statusCode >= 400;
	const errorClassification = hasError
		? classifyError(params.statusCode, params.error instanceof Error ? params.error : undefined)
		: undefined;

	const errorMessage =
		params.error instanceof Error ? sanitizeErrorMessage(params.error.message) : undefined;

	const stackTrace = extractStackTrace(params.error, params.statusCode);

	return {
		route: params.route,
		method: params.method,
		statusCode: params.statusCode,
		latencyMs: params.latencyMs,
		requestSizeBytes: params.requestSizeBytes,
		responseSizeBytes: params.responseSizeBytes,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		correlationId,
		timestamp,
		actorId: context?.actorId,
		actorType: context?.actorType,
		monitoringUserId: context?.monitoringUserId,
		errorClassification,
		hasError,
		errorMessage,
		stackTrace,
		sourceApplication: params.sourceApplication,
		retryCount: params.retryCount,
	};
}
