import { APP_INTERCEPTOR } from '@nestjs/core';
import { API_MONITORING_ASYNC_CONTEXT, IApiMonitoringAsyncContext } from '../../src/interfaces/async-context.port.js';
import { ApiMonitoringModule } from '../../src/api-monitoring.module.js';
import { ApiMonitoringInterceptor } from '../../src/interceptors/api-monitoring.interceptor.js';
import { API_MONITORING_MODULE_OPTIONS } from '../../src/tokens/api-monitoring-module-options.token.js';
import { API_MONITORING_ON_EXCHANGE } from '../../src/tokens/api-monitoring-on-exchange.token.js';

class MockAsyncContext implements IApiMonitoringAsyncContext {
	getStore = jest.fn().mockReturnValue(undefined);
	getCorrelationId = jest.fn().mockReturnValue(undefined);
}

describe('ApiMonitoringModule.forRoot', () => {
	const findByToken = (providers: any[], token: any) => providers.find((p) => p && p.provide === token);

	it('registers only the global interceptor and context (no DB, no controller)', () => {
		const noop = jest.fn();
		const mod = ApiMonitoringModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: noop,
		});

		expect(mod.module).toBe(ApiMonitoringModule);
		expect(mod.imports).toEqual([]);
		expect(mod.controllers).toEqual([]);

		const providers: any[] = mod.providers as any[];
		expect(findByToken(providers, API_MONITORING_ASYNC_CONTEXT)).toMatchObject({ useClass: MockAsyncContext });
		const modOpts = findByToken(providers, API_MONITORING_MODULE_OPTIONS);
		expect(modOpts.useValue).toEqual({
			exchangePayloadMaxBytes: 16_384,
			captureExchangeRequestPayload: true,
			captureExchangeResponsePayload: true,
		});
		expect(findByToken(providers, API_MONITORING_ON_EXCHANGE)).toEqual({
			provide: API_MONITORING_ON_EXCHANGE,
			useValue: noop,
		});
		const appInter = findByToken(providers, APP_INTERCEPTOR);
		expect(appInter).toEqual({ provide: APP_INTERCEPTOR, useClass: ApiMonitoringInterceptor });
	});

	it('throws when onApiExchange is missing', () => {
		expect(() =>
			ApiMonitoringModule.forRoot({
				asyncContext: MockAsyncContext,
				onApiExchange: undefined as any,
			}),
		).toThrow(/onApiExchange/);
	});

	it('clamps exchangePayloadMaxBytes', () => {
		const mod = ApiMonitoringModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: jest.fn(),
			exchangePayloadMaxBytes: 99,
		});
		const modOpts = (mod.providers as any[]).find((p) => p && p.provide === API_MONITORING_MODULE_OPTIONS);
		expect(modOpts.useValue.exchangePayloadMaxBytes).toBe(256);
	});

	it('respects captureExchangeRequestPayload and captureExchangeResponsePayload when false', () => {
		const mod = ApiMonitoringModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: jest.fn(),
			captureExchangeRequestPayload: false,
			captureExchangeResponsePayload: false,
		});
		const modOpts = (mod.providers as any[]).find((p) => p && p.provide === API_MONITORING_MODULE_OPTIONS);
		expect(modOpts.useValue).toMatchObject({
			exchangePayloadMaxBytes: 16_384,
			captureExchangeRequestPayload: false,
			captureExchangeResponsePayload: false,
		});
	});

	it('exports ApiRequestContextService only', () => {
		const { exports: ex } = ApiMonitoringModule.forRoot({
			asyncContext: MockAsyncContext,
			onApiExchange: jest.fn(),
		});
		expect(ex).toHaveLength(1);
	});
});
