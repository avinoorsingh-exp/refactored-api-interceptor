import { Test } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { Request, Response } from 'express';
import { ApiMonitoringInterceptor } from '../../src/interceptors/api-monitoring.interceptor.js';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { HttpMethod, ApiActorType, ApiErrorClassification } from '../../src/domain/api-monitoring.types.js';
import { API_MONITORING_MODULE_OPTIONS } from '../../src/tokens/api-monitoring-module-options.token.js';
import { API_MONITORING_ON_EXCHANGE } from '../../src/tokens/api-monitoring-on-exchange.token.js';
import { API_MONITORING_ASYNC_CONTEXT } from '../../src/interfaces/async-context.port.js';

const defaultModuleOpts = {
	exchangePayloadMaxBytes: 16_384,
	captureExchangeRequestPayload: true,
	captureExchangeResponsePayload: true,
} as const;

async function flushMicrotasks(): Promise<void> {
	await new Promise<void>((r) => setImmediate(r));
}

describe('ApiMonitoringInterceptor', () => {
	let interceptor: ApiMonitoringInterceptor;
	let onExchange: jest.Mock;
	let mockAsyncContext: { getStore: jest.Mock; getCorrelationId: jest.Mock };
	let mockExecutionContext: ExecutionContext;
	let mockCallHandler: CallHandler;
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;

	beforeEach(async () => {
		onExchange = jest.fn();
		mockAsyncContext = {
			getStore: jest.fn().mockReturnValue(undefined),
			getCorrelationId: jest.fn().mockReturnValue(undefined),
		};

		mockRequest = {
			method: 'GET',
			path: '/v1/agents',
			originalUrl: '/v1/agents',
			route: { path: '/v1/agents' },
			query: {},
			headers: {},
			ip: '203.0.113.1',
			get: jest.fn(),
			body: {},
			socket: { remoteAddress: '203.0.113.1' } as any,
		};

		mockResponse = {
			statusCode: 200,
		};

		mockExecutionContext = {
			switchToHttp: jest.fn().mockReturnValue({
				getRequest: jest.fn().mockReturnValue(mockRequest),
				getResponse: jest.fn().mockReturnValue(mockResponse),
			}),
		} as any;

		mockCallHandler = {
			handle: jest.fn().mockReturnValue(of({ data: 'test' })),
		} as any;

		const module = await Test.createTestingModule({
			providers: [
				ApiMonitoringInterceptor,
				ApiRequestContextService,
				{ provide: API_MONITORING_ASYNC_CONTEXT, useValue: mockAsyncContext },
				{ provide: API_MONITORING_MODULE_OPTIONS, useValue: { ...defaultModuleOpts } },
				{ provide: API_MONITORING_ON_EXCHANGE, useValue: onExchange },
			],
		}).compile();

		interceptor = module.get(ApiMonitoringInterceptor);
	});

	describe('successful exchange (phase completed)', () => {
		it('notifies host with response body capture and summary', async () => {
			(mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0');

			const data = await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			expect(data).toEqual({ data: 'test' });
			await flushMicrotasks();

			expect(onExchange).toHaveBeenCalledTimes(1);
			const ev = onExchange.mock.calls[0][0];
			expect(ev.phase).toBe('completed');
			expect(ev.summary.route).toBe('/v1/agents');
			expect(ev.summary.method).toBe(HttpMethod.GET);
			expect(ev.summary.statusCode).toBe(200);
			expect(ev.summary.hasError).toBe(false);
			expect(ev.response?.body).toMatchObject({ kind: 'json' });
			expect(ev.request.headers).toEqual({});
		});

		it('omits response.body when captureExchangeResponsePayload is false', async () => {
			const module = await Test.createTestingModule({
				providers: [
					ApiMonitoringInterceptor,
					ApiRequestContextService,
					{ provide: API_MONITORING_ASYNC_CONTEXT, useValue: mockAsyncContext },
					{
						provide: API_MONITORING_MODULE_OPTIONS,
						useValue: { ...defaultModuleOpts, captureExchangeResponsePayload: false },
					},
					{ provide: API_MONITORING_ON_EXCHANGE, useValue: onExchange },
				],
			}).compile();
			interceptor = module.get(ApiMonitoringInterceptor);
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			const ev = onExchange.mock.calls[0][0];
			expect(ev.phase).toBe('completed');
			expect(ev.response?.httpStatus).toBe(200);
			expect(ev.response?.body).toBeUndefined();
		});

		it('omits request.body when captureExchangeRequestPayload is false', async () => {
			const module = await Test.createTestingModule({
				providers: [
					ApiMonitoringInterceptor,
					ApiRequestContextService,
					{ provide: API_MONITORING_ASYNC_CONTEXT, useValue: mockAsyncContext },
					{
						provide: API_MONITORING_MODULE_OPTIONS,
						useValue: { ...defaultModuleOpts, captureExchangeRequestPayload: false },
					},
					{ provide: API_MONITORING_ON_EXCHANGE, useValue: onExchange },
				],
			}).compile();
			interceptor = module.get(ApiMonitoringInterceptor);
			mockRequest.method = 'POST';
			mockRequest.body = { a: 1 };
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].request.body).toBeUndefined();
		});

		it('reflects correlation id and actor from async store in summary and context snapshot', async () => {
			mockAsyncContext.getCorrelationId.mockReturnValue('corr-from-shortcut');
			mockAsyncContext.getStore.mockReturnValue({
				correlationId: 'corr-on-store',
				timestamp: 1_700_000_000_000,
				actorId: 'actor-99',
				actorType: ApiActorType.USER,
				monitoringUserId: 'mu-1',
			});
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			const ev = onExchange.mock.calls[0][0];
			expect(ev.summary.correlationId).toBe('corr-from-shortcut');
			expect(ev.summary.actorId).toBe('actor-99');
			expect(ev.summary.actorType).toBe(ApiActorType.USER);
			expect(ev.summary.monitoringUserId).toBe('mu-1');
			expect(ev.context.actorId).toBe('actor-99');
			expect(ev.context.monitoringUserId).toBe('mu-1');
		});

		it('uses store correlation when getCorrelationId returns undefined', async () => {
			mockAsyncContext.getCorrelationId.mockReturnValue(undefined);
			mockAsyncContext.getStore.mockReturnValue({
				correlationId: 'only-on-store',
				timestamp: 1,
			});
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.correlationId).toBe('only-on-store');
		});

		it('uses X-Forwarded-For for IP in summary', async () => {
			(mockRequest.get as jest.Mock).mockImplementation((h: string) => {
				if (h === 'x-forwarded-for') return '203.0.113.1, 192.168.1.1';
				return undefined;
			});

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.ipAddress).toBe('203.0.113.1');
		});

		it('uses X-Real-IP when present', async () => {
			(mockRequest.get as jest.Mock).mockImplementation((h: string) => {
				if (h === 'x-real-ip') return '203.0.113.2';
				return undefined;
			});

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.ipAddress).toBe('203.0.113.2');
		});

		it('derives requestSizeBytes from Content-Length when body is absent', async () => {
			mockRequest.body = undefined;
			(mockRequest.get as jest.Mock).mockImplementation((h: string) => {
				if (h === 'content-length') return '2048';
				return undefined;
			});
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.requestSizeBytes).toBe(2048);
		});

		it('maps POST method in summary', async () => {
			mockRequest.method = 'POST';
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.method).toBe(HttpMethod.POST);
		});

		it('passes x-source-app and x-retry-count into summary', async () => {
			(mockRequest.get as jest.Mock).mockImplementation((h: string) => {
				if (h === 'x-source-app') return 'IMS';
				if (h === 'x-retry-count') return '2';
				return undefined;
			});

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.sourceApplication).toBe('IMS');
			expect(onExchange.mock.calls[0][0].summary.retryCount).toBe(2);
		});

		it('delivers binary response capture', async () => {
			mockCallHandler.handle = jest.fn().mockReturnValue(of(Buffer.from([1, 2, 3])));
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].response?.body).toMatchObject({
				kind: 'binary',
				totalBytes: 3,
			});
		});
	});

	describe('error exchange (phase error)', () => {
		it('notifies host and preserves thrown error for Nest', async () => {
			const error = new Error('Test error');
			(error as any).status = 500;
			mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));
			(mockRequest.get as jest.Mock).mockImplementation((h: string) =>
				h === 'user-agent' ? 'Mozilla/5.0' : undefined,
			);

			await expect(
				firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler)),
			).rejects.toBe(error);
			await flushMicrotasks();

			expect(onExchange).toHaveBeenCalled();
			const ev = onExchange.mock.calls[0][0];
			expect(ev.phase).toBe('error');
			expect(ev.summary.statusCode).toBe(500);
			expect(ev.summary.hasError).toBe(true);
			expect(ev.summary.errorClassification).toBe(ApiErrorClassification.SERVER_ERROR);
			expect(ev.error).toMatchObject({ kind: 'error', message: 'Test error' });
		});

		it('classifies validation-style errors for 400 when error name is BadRequestException', async () => {
			const err = new Error('bad');
			err.name = 'BadRequestException';
			(err as any).status = 400;
			mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => err));
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);
			onExchange.mockClear();

			await expect(
				firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler)),
			).rejects.toBe(err);
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].summary.errorClassification).toBe(
				ApiErrorClassification.VALIDATION_ERROR,
			);
		});
	});

	describe('skipped traffic (phase skipped)', () => {
		it('notifies once for localhost without running handler timing path', async () => {
			(mockRequest as { ip?: string }).ip = '127.0.0.1';
			(mockRequest.socket as any).remoteAddress = '127.0.0.1';
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange).toHaveBeenCalledTimes(1);
			expect(onExchange.mock.calls[0][0].phase).toBe('skipped');
			expect(onExchange.mock.calls[0][0].skipReason).toBe('interceptor_not_tracked');
			expect(onExchange.mock.calls[0][0].summary.statusCode).toBe(0);
		});

		it('skips when Origin matches API_MONITORING_EXCLUDE_ORIGINS', async () => {
			const prev = process.env.API_MONITORING_EXCLUDE_ORIGINS;
			process.env.API_MONITORING_EXCLUDE_ORIGINS = 'evil.example.com';
			try {
				(mockRequest.get as jest.Mock).mockImplementation((h: string) => {
					if (h === 'origin') return 'https://app.evil.example.com';
					return undefined;
				});
				onExchange.mockClear();

				await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
				await flushMicrotasks();

				expect(onExchange.mock.calls[0][0].phase).toBe('skipped');
			} finally {
				if (prev === undefined) {
					delete process.env.API_MONITORING_EXCLUDE_ORIGINS;
				} else {
					process.env.API_MONITORING_EXCLUDE_ORIGINS = prev;
				}
			}
		});
	});

	describe('host callback safety', () => {
		it('host callback rejection does not break the request', async () => {
			onExchange.mockRejectedValue(new Error('host failed'));
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);

			const data = await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			expect(data).toEqual({ data: 'test' });
			await flushMicrotasks();
		});
	});

	describe('request body capture (structured)', () => {
		beforeEach(async () => {
			const module = await Test.createTestingModule({
				providers: [
					ApiMonitoringInterceptor,
					ApiRequestContextService,
					{ provide: API_MONITORING_ASYNC_CONTEXT, useValue: mockAsyncContext },
					{ provide: API_MONITORING_MODULE_OPTIONS, useValue: { ...defaultModuleOpts } },
					{ provide: API_MONITORING_ON_EXCHANGE, useValue: onExchange },
				],
			}).compile();
			interceptor = module.get(ApiMonitoringInterceptor);
		});

		it('includes JSON body on request snapshot', async () => {
			mockRequest.method = 'POST';
			mockRequest.body = { hello: 'world' };
			(mockRequest.get as jest.Mock).mockReturnValue(undefined);
			onExchange.mockClear();

			await firstValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));
			await flushMicrotasks();

			expect(onExchange.mock.calls[0][0].request.body).toMatchObject({
				kind: 'json',
				json: '{"hello":"world"}',
			});
		});
	});
});
