/**
 * API monitoring domain types (self-contained; mirrors shared-domain contracts for DB compatibility).
 * @public
 */

export enum HttpMethod {
	GET = 'GET',
	POST = 'POST',
	PUT = 'PUT',
	PATCH = 'PATCH',
	DELETE = 'DELETE',
	HEAD = 'HEAD',
	OPTIONS = 'OPTIONS',
}

export enum ApiErrorClassification {
	CLIENT_ERROR = 'client_error',
	SERVER_ERROR = 'server_error',
	VALIDATION_ERROR = 'validation_error',
	AUTH_ERROR = 'auth_error',
	RATE_LIMIT_ERROR = 'rate_limit_error',
	TIMEOUT_ERROR = 'timeout_error',
	UNKNOWN_ERROR = 'unknown_error',
}

export enum ApiActorType {
	USER = 'user',
	API_KEY = 'api_key',
	SERVICE_ACCOUNT = 'service_account',
	ANONYMOUS = 'anonymous',
	SYSTEM = 'system',
}

export enum TimeBucket {
	MINUTE = 'minute',
	HOUR = 'hour',
	DAY = 'day',
}

/** Request metadata persisted for API monitoring. */
export interface ApiRequestMetadata {
	route: string;
	method: HttpMethod;
	statusCode: number;
	latencyMs: number;
	requestSizeBytes?: number;
	responseSizeBytes?: number;
	ipAddress?: string;
	userAgent?: string;
	correlationId: string;
	timestamp: Date;
	actorId?: string;
	actorType?: ApiActorType;
	/** Logical link to `core.api_monitoring_user.id` when populated by middleware for USER actors. */
	monitoringUserId?: string;
	errorClassification?: ApiErrorClassification;
	hasError: boolean;
	errorMessage?: string;
	stackTrace?: string;
	/** Snapshot of parsed request body when `captureRequestBody` is enabled in `ApiMonitoringModule.forRoot`. */
	requestBodySnapshot?: string;
	/** Normalized `x-source-app` when the caller sends it (e.g. `IMS`, `TRX`). */
	sourceApplication?: string;
}

export interface TimeSeriesQuery {
	startTime: Date;
	endTime: Date;
	route?: string | string[];
	method?: HttpMethod | HttpMethod[];
	timeBucket?: TimeBucket;
	actorId?: string;
	statusCode?: number | number[];
}

export interface ActorActivityQuery {
	actorId: string;
	startTime: Date;
	endTime: Date;
	limit: number;
}

export interface ErrorSampleQuery {
	startTime: Date;
	endTime: Date;
	classification?: ApiErrorClassification;
	route?: string;
	limit: number;
}
