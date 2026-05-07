/**
 * Domain types for HTTP API interception (no persistence layer).
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
