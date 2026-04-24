import { Test } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { Request, Response } from 'express';
import { ApiMonitoringInterceptor } from '../../src/interceptors/api-monitoring.interceptor.js';
import { ApiMonitoringService } from '../../src/services/api-monitoring.service.js';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { HttpMethod } from '../../src/domain/api-monitoring.types.js';

type AsyncTestDone = (reason?: string | Error) => void;

describe('ApiMonitoringInterceptor', () => {
	let interceptor: ApiMonitoringInterceptor;
	let monitoringService: jest.Mocked<ApiMonitoringService>;
	let contextService: jest.Mocked<ApiRequestContextService>;
	let mockExecutionContext: ExecutionContext;
	let mockCallHandler: CallHandler;
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;

	beforeEach(async () => {
		monitoringService = {
			buildRequestMetadata: jest.fn(),
			logRequest: jest.fn(),
		} as any;

		contextService = {
			setStartTime: jest.fn(),
		} as any;

		mockRequest = {
			method: 'GET',
			path: '/v1/agents',
			route: { path: '/v1/agents' },
			ip: '203.0.113.1', // Use external IP to avoid skipMonitoring
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
				{
					provide: ApiMonitoringService,
					useValue: monitoringService,
				},
				{
					provide: ApiRequestContextService,
					useValue: contextService,
				},
			],
		}).compile();

		interceptor = module.get<ApiMonitoringInterceptor>(ApiMonitoringInterceptor);
	});

	describe('intercept', () => {
		it('should log successful request', (done: AsyncTestDone) => {
			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			(mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0');

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			result.subscribe({
				next: (data: unknown) => {
					expect(data).toEqual({ data: 'test' });
					expect(contextService.setStartTime).toHaveBeenCalled();
					expect(monitoringService.buildRequestMetadata).toHaveBeenCalled();
					expect(monitoringService.logRequest).toHaveBeenCalledWith(metadata);
					done();
				},
			});
		});

		it('should log error request', (done: AsyncTestDone) => {
			const error = new Error('Test error');
			(error as any).status = 500;

			mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 500,
				latencyMs: 100,
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			(mockRequest.get as jest.Mock).mockImplementation((header: string) => {
				if (header === 'user-agent') {
					return 'Mozilla/5.0';
				}
				return undefined;
			});

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			result.subscribe({
				error: (err) => {
					expect(err).toBe(error);
					expect(monitoringService.buildRequestMetadata).toHaveBeenCalledWith(
						'/v1/agents',
						HttpMethod.GET,
						500,
						expect.any(Number),
						'203.0.113.1', // Updated to match mockRequest IP
						'Mozilla/5.0',
						error,
						expect.any(Number), // requestSizeBytes
						undefined, // responseSizeBytes not available on error
					);
					expect(monitoringService.logRequest).toHaveBeenCalledWith(metadata);
					done();
				},
			});
		});

		it('should extract IP from X-Forwarded-For header', (done: AsyncTestDone) => {
			(mockRequest.get as jest.Mock).mockImplementation((header: string) => {
				if (header === 'x-forwarded-for') {
					return '203.0.113.1, 192.168.1.1';
				}
				return undefined;
			});

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
				ipAddress: '203.0.113.1',
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			result.subscribe({
				next: () => {
					expect(monitoringService.buildRequestMetadata).toHaveBeenCalledWith(
						expect.any(String),
						expect.any(String),
						expect.any(Number),
						expect.any(Number),
						'203.0.113.1',
						undefined, // userAgent
						undefined, // error
						expect.any(Number), // requestSizeBytes
						expect.any(Number), // responseSizeBytes
					);
					done();
				},
			});
		});

		it('should extract IP from X-Real-IP header', (done: AsyncTestDone) => {
			(mockRequest.get as jest.Mock).mockImplementation((header: string) => {
				if (header === 'x-real-ip') {
					return '203.0.113.2';
				}
				return undefined;
			});

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
				ipAddress: '203.0.113.2',
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			result.subscribe({
				next: () => {
					expect(monitoringService.buildRequestMetadata).toHaveBeenCalled();
					const callArgs = monitoringService.buildRequestMetadata.mock.calls[0];
					expect(callArgs[4]).toBe('203.0.113.2'); // ipAddress
					done();
				},
			});
		});

		it('should calculate request size from body', async () => {
			mockRequest.body = { key: 'value' };

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.POST,
				statusCode: 200,
				latencyMs: 100,
				requestSizeBytes: 15, // Approximate size of {"key":"value"}
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			(mockRequest.get as jest.Mock).mockReturnValue(undefined);

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			await firstValueFrom(result);

			// The interceptor calculates request size from body JSON.stringify
			expect(monitoringService.buildRequestMetadata).toHaveBeenCalled();
			const callArgs = monitoringService.buildRequestMetadata.mock.calls[0];
			expect(callArgs[7]).toBeGreaterThan(0); // requestSizeBytes should be calculated
		});

		it('should calculate request size from Content-Length header', async () => {
			// Remove body so Content-Length is used
			mockRequest.body = undefined;
			
			(mockRequest.get as jest.Mock).mockImplementation((header: string) => {
				if (header === 'content-length') {
					return '1024';
				}
				return undefined;
			});

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.POST,
				statusCode: 200,
				latencyMs: 100,
				requestSizeBytes: 1024,
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			await firstValueFrom(result);

			expect(monitoringService.buildRequestMetadata).toHaveBeenCalled();
			const callArgs = monitoringService.buildRequestMetadata.mock.calls[0];
			expect(callArgs[7]).toBe(1024); // requestSizeBytes from Content-Length
		});

		it('should handle logging errors gracefully', (done: AsyncTestDone) => {
			monitoringService.logRequest.mockRejectedValue(new Error('Logging failed'));

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);

			(mockRequest.get as jest.Mock).mockReturnValue(undefined);

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			result.subscribe({
				next: (data: unknown) => {
					// Should still return data even if logging fails
					expect(data).toEqual({ data: 'test' });
					done();
				},
			});
		});

		it('should map HTTP method correctly', async () => {
			mockRequest.method = 'POST';

			const metadata = {
				route: '/v1/agents',
				method: HttpMethod.POST,
				statusCode: 200,
				latencyMs: 100,
			} as any;

			monitoringService.buildRequestMetadata.mockReturnValue(metadata);
			monitoringService.logRequest.mockResolvedValue(undefined);

			(mockRequest.get as jest.Mock).mockReturnValue(undefined);

			const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

			await firstValueFrom(result);

			expect(monitoringService.buildRequestMetadata).toHaveBeenCalled();
			const callArgs = monitoringService.buildRequestMetadata.mock.calls[0];
			expect(callArgs[1]).toBe(HttpMethod.POST); // method should be POST
		});
	});
});

