import { DynamicModule, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiInterceptor } from './interceptors/api-interceptor.interceptor.js';
import { ApiRequestContextService } from './services/api-request-context.service.js';
import type { ApiInterceptorForRootOptions } from './options/api-interceptor-for-root.options.js';
import { API_INTERCEPTOR_ASYNC_CONTEXT } from './interfaces/async-context.port.js';
import {
	API_INTERCEPTOR_MODULE_OPTIONS,
	type ApiInterceptorModuleRuntimeOptions,
} from './tokens/api-interceptor-module-options.token.js';
import { API_INTERCEPTOR_ON_EXCHANGE } from './tokens/api-interceptor-on-exchange.token.js';

/**
 * Registers the global HTTP interceptor and async request context for API exchange observation.
 * No database, entities, or persistence — the host receives data only via `onApiExchange`.
 * @public
 */
@Global()
export class ApiInterceptorModule {
	static forRoot(options: ApiInterceptorForRootOptions): DynamicModule {
		if (typeof options.onApiExchange !== 'function') {
			throw new Error('ApiInterceptorModule.forRoot requires a function `onApiExchange`.');
		}

		const maxBytesRaw = options.exchangePayloadMaxBytes ?? 16_384;
		const exchangePayloadMaxBytes = Math.min(1_048_576, Math.max(256, maxBytesRaw));
		const runtimeOptions: ApiInterceptorModuleRuntimeOptions = {
			exchangePayloadMaxBytes,
			captureExchangeRequestPayload: options.captureExchangeRequestPayload !== false,
			captureExchangeResponsePayload: options.captureExchangeResponsePayload !== false,
		};

		return {
			module: ApiInterceptorModule,
			imports: [],
			providers: [
				{ provide: API_INTERCEPTOR_MODULE_OPTIONS, useValue: runtimeOptions },
				{ provide: API_INTERCEPTOR_ON_EXCHANGE, useValue: options.onApiExchange },
				{
					provide: API_INTERCEPTOR_ASYNC_CONTEXT,
					useClass: options.asyncContext,
				},
				ApiRequestContextService,
				{
					provide: APP_INTERCEPTOR,
					useClass: ApiInterceptor,
				},
			],
			controllers: [],
			exports: [ApiRequestContextService],
		};
	}
}
