import { jest, describe, it, expect } from '@jest/globals';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { API_INTERCEPTOR_ASYNC_CONTEXT, IApiInterceptorAsyncContext } from '../../src/interfaces/async-context.port.js';
import { ApiInterceptorModule } from '../../src/api-interceptor.module.js';
import { ApiInterceptor } from '../../src/interceptors/api-interceptor.interceptor.js';
import { API_INTERCEPTOR_MODULE_OPTIONS } from '../../src/tokens/api-interceptor-module-options.token.js';
import { API_INTERCEPTOR_ON_EXCHANGE } from '../../src/tokens/api-interceptor-on-exchange.token.js';

class MockAsyncContext implements IApiInterceptorAsyncContext {
	getStore = jest.fn().mockReturnValue(undefined);
	getCorrelationId = jest.fn().mockReturnValue(undefined);
}

describe('ApiInterceptorModule.forRoot', () => {
	const findByToken = (providers: any[], token: any) => providers.find((p) => p && p.provide === token);

	it('registers only the global interceptor and context (no DB, no controller)', () => {
		const noop = jest.fn();
		const mod = ApiInterceptorModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: noop,
		});

		expect(mod.module).toBe(ApiInterceptorModule);
		expect(mod.imports).toEqual([]);
		expect(mod.controllers).toEqual([]);

		const providers: any[] = mod.providers as any[];
		expect(findByToken(providers, API_INTERCEPTOR_ASYNC_CONTEXT)).toMatchObject({ useClass: MockAsyncContext });
		const modOpts = findByToken(providers, API_INTERCEPTOR_MODULE_OPTIONS);
		expect(modOpts.useValue).toEqual({
			exchangePayloadMaxBytes: 16_384,
			captureExchangeRequestPayload: true,
			captureExchangeResponsePayload: true,
		});
		expect(findByToken(providers, API_INTERCEPTOR_ON_EXCHANGE)).toEqual({
			provide: API_INTERCEPTOR_ON_EXCHANGE,
			useValue: noop,
		});
		const appInter = findByToken(providers, APP_INTERCEPTOR);
		expect(appInter).toEqual({ provide: APP_INTERCEPTOR, useClass: ApiInterceptor });
	});

	it('throws when onApiExchange is missing', () => {
		expect(() =>
			ApiInterceptorModule.forRoot({
				asyncContext: MockAsyncContext,
				onApiExchange: undefined as any,
			}),
		).toThrow(/onApiExchange/);
	});

	it('clamps exchangePayloadMaxBytes', () => {
		const mod = ApiInterceptorModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: jest.fn(),
			exchangePayloadMaxBytes: 99,
		});
		const modOpts = (mod.providers as any[]).find((p) => p && p.provide === API_INTERCEPTOR_MODULE_OPTIONS);
		expect(modOpts.useValue.exchangePayloadMaxBytes).toBe(256);
	});

	it('respects captureExchangeRequestPayload and captureExchangeResponsePayload when false', () => {
		const mod = ApiInterceptorModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: jest.fn(),
			captureExchangeRequestPayload: false,
			captureExchangeResponsePayload: false,
		});
		const modOpts = (mod.providers as any[]).find((p) => p && p.provide === API_INTERCEPTOR_MODULE_OPTIONS);
		expect(modOpts.useValue).toMatchObject({
			exchangePayloadMaxBytes: 16_384,
			captureExchangeRequestPayload: false,
			captureExchangeResponsePayload: false,
		});
	});

	it('exports ApiRequestContextService only', () => {
		const { exports: ex } = ApiInterceptorModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: jest.fn(),
		});
		expect(ex).toHaveLength(1);
	});
});
