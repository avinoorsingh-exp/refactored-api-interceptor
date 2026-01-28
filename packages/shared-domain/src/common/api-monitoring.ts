import { z } from 'zod'

/**
 * API Monitoring Types
 * 
 * Shared types for API request monitoring, metrics, and observability.
 * Used by both backend (logging) and frontend (dashboards).
 * 
 * @public
 */

/**
 * HTTP method enum for API requests.
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

/**
 * Error classification for API requests.
 * @public
 */
export enum ApiErrorClassification {
	CLIENT_ERROR = 'client_error', // 4xx
	SERVER_ERROR = 'server_error', // 5xx
	VALIDATION_ERROR = 'validation_error',
	AUTH_ERROR = 'auth_error',
	RATE_LIMIT_ERROR = 'rate_limit_error',
	TIMEOUT_ERROR = 'timeout_error',
	UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Actor type for request attribution.
 * @public
 */
export enum ApiActorType {
	USER = 'user',
	API_KEY = 'api_key',
	SERVICE_ACCOUNT = 'service_account',
	ANONYMOUS = 'anonymous',
	SYSTEM = 'system',
}

/**
 * Time bucket for metrics aggregation.
 * @public
 */
export enum TimeBucket {
	MINUTE = 'minute',
	HOUR = 'hour',
	DAY = 'day',
}

/**
 * Actor identifier schema.
 * @public
 */
export const ApiActorSchema = z.object({
	id: z.string().uuid(),
	type: z.nativeEnum(ApiActorType),
	identifier: z.string().optional(), // user email, api key name, etc.
})

export type ApiActor = z.infer<typeof ApiActorSchema>

/**
 * Request metadata schema.
 * @public
 */
export const ApiRequestMetadataSchema = z.object({
	route: z.string(), // e.g., '/v1/agents'
	method: z.nativeEnum(HttpMethod),
	statusCode: z.number().int().min(100).max(599),
	latencyMs: z.number().nonnegative(),
	requestSizeBytes: z.number().nonnegative().optional(),
	responseSizeBytes: z.number().nonnegative().optional(),
	ipAddress: z.string().ip().optional(),
	userAgent: z.string().optional(),
	correlationId: z.string().uuid(),
	timestamp: z.date(),
	actorId: z.string().uuid().optional(),
	actorType: z.nativeEnum(ApiActorType).optional(),
	errorClassification: z.nativeEnum(ApiErrorClassification).optional(),
	hasError: z.boolean(),
	errorMessage: z.string().optional(),
	stackTrace: z.string().optional(), // Only for server errors
})

export type ApiRequestMetadata = z.infer<typeof ApiRequestMetadataSchema>

/**
 * Route statistics schema for aggregated metrics.
 * @public
 */
export const ApiRouteStatsSchema = z.object({
	route: z.string(),
	method: z.nativeEnum(HttpMethod),
	timeBucket: z.nativeEnum(TimeBucket),
	bucketStart: z.date(),
	requestCount: z.number().int().nonnegative(),
	errorCount: z.number().int().nonnegative(),
	latencyP50: z.number().nonnegative().optional(),
	latencyP95: z.number().nonnegative().optional(),
	latencyP99: z.number().nonnegative().optional(),
	latencyMin: z.number().nonnegative().optional(),
	latencyMax: z.number().nonnegative().optional(),
	statusCodeCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
})

export type ApiRouteStats = z.infer<typeof ApiRouteStatsSchema>

/**
 * Time series query parameters.
 * @public
 */
export const TimeSeriesQuerySchema = z.object({
	startTime: z.date(),
	endTime: z.date(),
	route: z.union([z.string(), z.array(z.string())]).optional(),
	method: z.union([z.nativeEnum(HttpMethod), z.array(z.nativeEnum(HttpMethod))]).optional(),
	timeBucket: z.nativeEnum(TimeBucket).optional(), // Optional: auto-selected based on time range if not provided
	actorId: z.string().uuid().optional(),
	statusCode: z.union([z.number(), z.array(z.number())]).optional(),
})

export type TimeSeriesQuery = z.infer<typeof TimeSeriesQuerySchema>

/**
 * Actor activity query parameters.
 * @public
 */
export const ActorActivityQuerySchema = z.object({
	actorId: z.string().uuid(),
	startTime: z.date(),
	endTime: z.date(),
	limit: z.number().int().positive().max(1000).default(100),
})

export type ActorActivityQuery = z.infer<typeof ActorActivityQuerySchema>

/**
 * Error sample query parameters.
 * @public
 */
export const ErrorSampleQuerySchema = z.object({
	startTime: z.date(),
	endTime: z.date(),
	classification: z.nativeEnum(ApiErrorClassification).optional(),
	route: z.string().optional(),
	limit: z.number().int().positive().max(100).default(50),
})

export type ErrorSampleQuery = z.infer<typeof ErrorSampleQuerySchema>

