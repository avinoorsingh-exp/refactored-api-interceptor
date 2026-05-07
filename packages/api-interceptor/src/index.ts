/**
 * @exprealty/api-monitoring
 *
 * NestJS HTTP API interception: captures each request/response and delivers a structured event to the host.
 *
 * @public
 */

export { ApiMonitoringModule } from './api-monitoring.module.js';

export type { ApiMonitoringForRootOptions } from './options/api-monitoring-for-root.options.js';

export type {
	IApiMonitoringAsyncContext,
	ApiMonitoringRequestStore,
} from './interfaces/async-context.port.js';
export { API_MONITORING_ASYNC_CONTEXT } from './interfaces/async-context.port.js';

export { HttpMethod, ApiActorType, ApiErrorClassification } from './domain/api-monitoring.types.js';

export type {
	ApiCapturedPayload,
	ApiExchangeContextSnapshot,
	ApiExchangeEvent,
	ApiExchangeRequestSnapshot,
	ApiExchangeResponseSnapshot,
	ApiExchangeSummary,
} from './domain/api-exchange.event.js';
export {
	API_MONITORING_ON_EXCHANGE,
	type ApiExchangeHandler,
} from './tokens/api-monitoring-on-exchange.token.js';

export { ApiRequestContextService } from './services/api-request-context.service.js';
export { ApiMonitoringInterceptor } from './interceptors/api-monitoring.interceptor.js';

export {
	API_MONITORING_SOURCE_APP_HEADER,
	parseSourceApplicationHeader,
} from './utils/parse-source-application-header.util.js';
export {
	API_MONITORING_RETRY_COUNT_HEADER,
	parseRetryCountHeader,
} from './utils/parse-retry-count-header.util.js';
