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
		// `onApiExchange` is the only required runtime integration point:
		// the interceptor emits an `ApiExchangeEvent` to this callback for every observed exchange.
		if (typeof options.onApiExchange !== 'function') {
			throw new Error('ApiInterceptorModule.forRoot requires a function `onApiExchange`.');
		}

		// Clamp capture size to prevent accidental huge payload snapshots.
		// (The interceptor will still capture non-body metadata regardless.)
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
				// Runtime flags consumed by `ApiInterceptor` (payload capture, byte limits).
				{ provide: API_INTERCEPTOR_MODULE_OPTIONS, useValue: runtimeOptions },

				// The host-provided callback function invoked by the interceptor.
				{ provide: API_INTERCEPTOR_ON_EXCHANGE, useValue: options.onApiExchange },
				{
					// Bridge into the host's async-local context (ALS/store) so we can read correlation/actor fields.
					provide: API_INTERCEPTOR_ASYNC_CONTEXT,//ApiRequestContextService injects it to read the per-request store (correlationId, actorId, etc.).
					useClass: options.asyncContext,
				},

				// Small helper service that reads/writes fields on the async-context store.
				ApiRequestContextService,//helper service
				{
					// Register the interceptor globally for the Nest app (applies to all controllers/routes).
					provide: APP_INTERCEPTOR,
					useClass: ApiInterceptor,
				},
			],
			controllers: [],
			// Exported so host code can inject it (e.g., middleware/guards can write actor info into the store).
			exports: [ApiRequestContextService],
		};
	}
}
