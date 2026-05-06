/**
 * @exprealty/api-monitoring
 *
 * API Monitoring and Observability Package
 * Provides comprehensive HTTP request monitoring, metrics, and observability for NestJS applications.
 *
 * @public
 */

// Module
export { ApiMonitoringModule } from './api-monitoring.module.js';

export type { ApiMonitoringForRootOptions } from './options/api-monitoring-for-root.options.js';
export type { ApiMonitoringEntityClasses } from './tokens/entity-classes.token.js';
export { API_MONITORING_ENTITY_CLASSES } from './tokens/entity-classes.token.js';
export {
	DEFAULT_API_MONITORING_ENTITIES,
	API_MONITORING_TYPEORM_ENTITIES,
} from './entities/default-entities.js';
export { ApiActorEntity } from './entities/api-actor.entity.js';
export { ApiMonitoringUserEntity } from './entities/api-monitoring-user.entity.js';
export { ApiRequestLogEntity } from './entities/api-request-log.entity.js';
export { ApiRouteStatsEntity } from './entities/api-route-stats.entity.js';

// Interfaces
export type { IApiMonitoringLogger } from './interfaces/logger.interface.js';
export { API_MONITORING_LOGGER_TOKEN } from './interfaces/logger.interface.js';
export type {
	IApiMonitoringAsyncContext,
	ApiMonitoringRequestStore,
} from './interfaces/async-context.port.js';
export { API_MONITORING_ASYNC_CONTEXT } from './interfaces/async-context.port.js';

// Domain (for consumers aligning types with persisted values)
export {
	HttpMethod,
	TimeBucket,
	ApiActorType,
	ApiErrorClassification,
	type ApiRequestMetadata,
	type TimeSeriesQuery,
	type ActorActivityQuery,
	type ErrorSampleQuery,
} from './domain/api-monitoring.types.js';
export type {
	ApiRequestLogOutcome,
	ApiRequestLogSavedOutcome,
	ApiRequestLogSkippedOutcome,
	ApiRequestLogSkippedReason,
	ApiRequestLogErrorOutcome,
	ApiRequestLogErrorReason,
} from './domain/api-request-log-outcome.js';
export {
	API_MONITORING_REQUEST_LOG_STATUS_HEADER,
	API_MONITORING_REQUEST_LOG_REASON_HEADER,
	API_MONITORING_REQUEST_LOG_MESSAGE_HEADER,
} from './domain/api-request-log-outcome.js';

// Services
export { ApiRequestContextService } from './services/api-request-context.service.js';
export { ApiActorService } from './services/api-actor.service.js';
export { ApiMonitoringUserService } from './services/api-monitoring-user.service.js';
export { ApiMonitoringService } from './services/api-monitoring.service.js';
export { ApiMetricsService } from './services/api-metrics.service.js';

// Middleware
export { ApiActorMiddleware } from './middleware/api-actor.middleware.js';

// Interceptors
export { ApiMonitoringInterceptor } from './interceptors/api-monitoring.interceptor.js';

// Controller (optional - services can exclude if they don't want admin endpoints)
export { ApiMonitoringController } from './api-monitoring.controller.js';

// DTOs (for services that want to extend the controller)
export { TimeSeriesQueryDto } from './dto/time-series-query.dto.js';
export { toArray, hasValues } from './utils/filter.util.js';
export { ActorActivityQueryDto } from './dto/actor-activity-query.dto.js';
export { ErrorSampleQueryDto } from './dto/error-sample-query.dto.js';
export { TopCallersQueryDto } from './dto/top-callers-query.dto.js';
export { PaginationQueryDto } from './dto/pagination-query.dto.js';
export { TrendsQueryDto, TrendsRange } from './dto/trends-query.dto.js';
export {
	TrendsResponseDto,
	TrendBucketMetricsDto,
	TrendsKpiSummaryDto,
	PeriodDeltaDto,
} from './dto/trends-response.dto.js';
export { AvailableRoutesQueryDto } from './dto/available-routes-query.dto.js';
export { AvailableRoutesResponseDto } from './dto/available-routes-response.dto.js';

// Response DTOs
export { PageInfoDto } from './dto/page-info.dto.js';
export { PaginatedErrorSampleResponseDto } from './dto/paginated-error-sample-response.dto.js';
export { PaginatedActorActivityResponseDto } from './dto/paginated-actor-activity-response.dto.js';
export { PaginatedTopCallersResponseDto } from './dto/paginated-top-callers-response.dto.js';
export { TopCallerResponseDto } from './dto/top-caller-response.dto.js';
export { SummaryResponseDto } from './dto/summary-response.dto.js';
export { AggregationResponseDto } from './dto/aggregation-response.dto.js';

// Utilities
export {
	decodeCursor,
	encodeCursor,
	normalizeLimit,
	createPaginatedResponse,
	type PaginationParams,
	type PageInfo,
	type PaginatedResponse,
} from './utils/pagination.util.js';
export { shouldLogApiRequest } from './utils/should-log-api-request.util.js';
export {
	API_MONITORING_SOURCE_APP_HEADER,
	parseSourceApplicationHeader,
} from './utils/parse-source-application-header.util.js';
export {
	API_MONITORING_RETRY_COUNT_HEADER,
	parseRetryCountHeader,
} from './utils/parse-retry-count-header.util.js';
export {
	resolveTrendBucketType,
	calculateBucketCount,
	getWeekStart,
	getWeekEnd,
} from './utils/bucket-resolution.util.js';
export { API_MONITORING_USER_REPO } from './tokens/repository.tokens.js';

