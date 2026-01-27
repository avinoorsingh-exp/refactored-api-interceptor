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

// Interfaces
export type { IApiMonitoringLogger } from './interfaces/logger.interface.js';
export { API_MONITORING_LOGGER_TOKEN } from './interfaces/logger.interface.js';

// Services
export { ApiRequestContextService } from './services/api-request-context.service.js';
export { ApiActorService } from './services/api-actor.service.js';
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
export { ActorActivityQueryDto } from './dto/actor-activity-query.dto.js';
export { ErrorSampleQueryDto } from './dto/error-sample-query.dto.js';
export { TopCallersQueryDto } from './dto/top-callers-query.dto.js';
export { PaginationQueryDto } from './dto/pagination-query.dto.js';

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

