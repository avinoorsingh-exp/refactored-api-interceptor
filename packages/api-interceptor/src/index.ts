/**
 * @exprealty/api-interceptor
 *
 * NestJS HTTP API interception: captures each request/response and delivers a structured event to the host.
 *
 * @public
 */

export { ApiInterceptorModule } from './api-interceptor.module.js';

export type { ApiInterceptorForRootOptions } from './options/api-interceptor-for-root.options.js';

export type {
	IApiInterceptorAsyncContext,
	ApiInterceptorRequestStore,
} from './interfaces/async-context.port.js';
export { API_INTERCEPTOR_ASYNC_CONTEXT } from './interfaces/async-context.port.js';

export { HttpMethod, ApiActorType, ApiErrorClassification } from './domain/api-interceptor.types.js';

export type {
	ApiCapturedPayload,
	ApiExchangeContextSnapshot,
	ApiExchangeEvent,
	ApiExchangeRequestSnapshot,
	ApiExchangeResponseSnapshot,
	ApiExchangeSummary,
} from './domain/api-exchange.event.js';
export {
	API_INTERCEPTOR_ON_EXCHANGE,
	type ApiExchangeHandler,
} from './tokens/api-interceptor-on-exchange.token.js';

export { ApiRequestContextService } from './services/api-request-context.service.js';
export { ApiInterceptor } from './interceptors/api-interceptor.interceptor.js';

export {
	API_INTERCEPTOR_SOURCE_APP_HEADER,
	parseSourceApplicationHeader,
} from './utils/parse-source-application-header.util.js';
export {
	API_INTERCEPTOR_RETRY_COUNT_HEADER,
	parseRetryCountHeader,
} from './utils/parse-retry-count-header.util.js';
