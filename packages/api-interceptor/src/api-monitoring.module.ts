import { DynamicModule, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiMonitoringInterceptor } from './interceptors/api-monitoring.interceptor.js';
import { ApiRequestContextService } from './services/api-request-context.service.js';
import type { ApiMonitoringForRootOptions } from './options/api-monitoring-for-root.options.js';
import { API_MONITORING_ASYNC_CONTEXT } from './interfaces/async-context.port.js';
import {
	API_MONITORING_MODULE_OPTIONS,
	type ApiMonitoringModuleRuntimeOptions,
} from './tokens/api-monitoring-module-options.token.js';
import { API_MONITORING_ON_EXCHANGE } from './tokens/api-monitoring-on-exchange.token.js';

/**
 * Registers the global HTTP interceptor and async request context for API exchange observation.
 * No database, entities, or persistence — the host receives data only via `onApiExchange`.
 * @public
 */
@Global()
export class ApiMonitoringModule {
	static forRoot(options: ApiMonitoringForRootOptions): DynamicModule {
		if (typeof options.onApiExchange !== 'function') {
			throw new Error('ApiMonitoringModule.forRoot requires a function `onApiExchange`.');
		}

		const maxBytesRaw = options.exchangePayloadMaxBytes ?? 16_384;
		const exchangePayloadMaxBytes = Math.min(1_048_576, Math.max(256, maxBytesRaw));
		const runtimeOptions: ApiMonitoringModuleRuntimeOptions = {
			exchangePayloadMaxBytes,
			captureExchangeRequestPayload: options.captureExchangeRequestPayload !== false,
			captureExchangeResponsePayload: options.captureExchangeResponsePayload !== false,
		};

		return {
			module: ApiMonitoringModule,
			imports: [],
			providers: [
				{ provide: API_MONITORING_MODULE_OPTIONS, useValue: runtimeOptions },
				{ provide: API_MONITORING_ON_EXCHANGE, useValue: options.onApiExchange },
				{
					provide: API_MONITORING_ASYNC_CONTEXT,
					useClass: options.asyncContext,
				},
				ApiRequestContextService,
				{
					provide: APP_INTERCEPTOR,
					useClass: ApiMonitoringInterceptor,
				},
			],
			controllers: [],
			exports: [ApiRequestContextService],
		};
	}
}
