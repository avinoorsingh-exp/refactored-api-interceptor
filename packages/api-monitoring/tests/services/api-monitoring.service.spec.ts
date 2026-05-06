import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ApiMonitoringService } from '../../src/services/api-monitoring.service.js';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../../src/interfaces/logger.interface.js';
import {
	HttpMethod,
	ApiErrorClassification,
	ApiActorType,
	type ApiRequestMetadata,
} from '../../src/domain/api-monitoring.types.js';
import { API_MONITORING_REQUEST_LOG_REPO } from '../../src/tokens/repository.tokens.js';

describe('ApiMonitoringService', () => {
	let service: ApiMonitoringService;
	let requestLogRepo: jest.Mocked<Repository<Record<string, unknown>>>;
	let contextService: jest.Mocked<ApiRequestContextService>;
	let logger: jest.Mocked<IApiMonitoringLogger>;

	beforeEach(async () => {
		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		} as any;

		contextService = {
			getContext: jest.fn(),
			getCorrelationId: jest.fn(),
			getActorId: jest.fn(),
			getActorType: jest.fn(),
			updateActor: jest.fn(),
			setStartTime: jest.fn(),
			getStartTime: jest.fn(),
		} as any;

		requestLogRepo = {
			create: jest.fn(),
			save: jest.fn(),
		} as any;

		// Reset environment variables
		delete process.env.API_MONITORING_ENABLED;
		delete process.env.API_MONITORING_SAMPLE_RATE;

		const module = await Test.createTestingModule({
			providers: [
				ApiMonitoringService,
				{
					provide: API_MONITORING_REQUEST_LOG_REPO,
					useValue: requestLogRepo,
				},
				{
					provide: ApiRequestContextService,
					useValue: contextService,
				},
				{
					provide: API_MONITORING_LOGGER_TOKEN,
					useValue: logger,
				},
			],
		}).compile();

		service = module.get<ApiMonitoringService>(ApiMonitoringService);
	});

	describe('logRequest', () => {
		it('should log request when enabled', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
				correlationId: 'corr-123',
				timestamp: new Date(),
				hasError: false,
			};

			const mockLog = { id: 'log-123', ...metadata } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockResolvedValue(mockLog);

			const outcome = await service.logRequest(metadata);
			expect(outcome).toEqual({ status: 'saved' });

			expect(requestLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
			}));
			expect(requestLogRepo.save).toHaveBeenCalledWith(mockLog);
		});

		it('persists requestBodySnapshot when present on metadata', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.POST,
				statusCode: 400,
				latencyMs: 5,
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
				correlationId: 'corr-123',
				timestamp: new Date(),
				hasError: true,
				requestBodySnapshot: '{"a":1}',
			};

			const mockLog = { id: 'log-456', ...metadata } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockResolvedValue(mockLog);

			await service.logRequest(metadata);

			expect(requestLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ requestBodySnapshot: '{"a":1}' }),
			);
		});

		it('persists monitoringUserId when present on metadata', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 1,
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
				correlationId: 'corr-123',
				timestamp: new Date(),
				hasError: false,
				monitoringUserId: 'mu-uuid-1',
			};

			const mockLog = { id: 'log-789', ...metadata } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockResolvedValue(mockLog);

			await service.logRequest(metadata);

			expect(requestLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ monitoringUserId: 'mu-uuid-1' }),
			);
		});

		it('persists sourceApplication when present on metadata', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.POST,
				statusCode: 201,
				latencyMs: 2,
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
				correlationId: 'corr-123',
				timestamp: new Date(),
				hasError: false,
				sourceApplication: 'IMS',
			};

			const mockLog = { id: 'log-src', ...metadata } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockResolvedValue(mockLog);

			await service.logRequest(metadata);

			expect(requestLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ sourceApplication: 'IMS' }),
			);
		});

		it('persists retryCount when present on metadata', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.POST,
				statusCode: 200,
				latencyMs: 3,
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
				correlationId: 'corr-123',
				timestamp: new Date(),
				hasError: false,
				retryCount: 2,
			};

			const mockLog = { id: 'log-retry', ...metadata } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockResolvedValue(mockLog);

			await service.logRequest(metadata);

			expect(requestLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 2 }));
		});

		it('defaults retryCount to 0 when omitted on metadata', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 1,
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
				correlationId: 'corr-123',
				timestamp: new Date(),
				hasError: false,
			};

			const mockLog = { id: 'log-def', ...metadata } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockResolvedValue(mockLog);

			await service.logRequest(metadata);

			expect(requestLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
		});

		it('should skip logging when disabled', async () => {
			process.env.API_MONITORING_ENABLED = 'false';

			const module = await Test.createTestingModule({
				providers: [
					ApiMonitoringService,
					{
						provide: API_MONITORING_REQUEST_LOG_REPO,
						useValue: requestLogRepo,
					},
					{
						provide: ApiRequestContextService,
						useValue: contextService,
					},
					{
						provide: API_MONITORING_LOGGER_TOKEN,
						useValue: logger,
					},
				],
			}).compile();

			const disabledService = module.get<ApiMonitoringService>(ApiMonitoringService);

			const outcome = await disabledService.logRequest({
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
				correlationId: 'c',
				timestamp: new Date(),
				hasError: false,
			});

			expect(outcome).toMatchObject({ status: 'skipped', reason: 'monitoring_disabled' });
			expect(requestLogRepo.create).not.toHaveBeenCalled();
		});

		it('should handle save errors gracefully', async () => {
			const metadata: ApiRequestMetadata = {
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
				correlationId: 'corr-123',
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
				hasError: false,
				timestamp: new Date(),
			};

			const mockLog = { id: 'log-123' } as Record<string, unknown>;
			requestLogRepo.create.mockReturnValue(mockLog);
			requestLogRepo.save.mockRejectedValue(new Error('Database error'));

			const outcome = await service.logRequest(metadata);

			expect(outcome).toMatchObject({ status: 'error', reason: 'save_failed' });
			expect(logger.error).toHaveBeenCalledWith(
				'Failed to save API request log',
				expect.objectContaining({
					correlationId: 'corr-123',
					error: 'Database error',
				}),
			);
		});

		it('should respect sample rate', async () => {
			process.env.API_MONITORING_SAMPLE_RATE = '0.5';

			const module = await Test.createTestingModule({
				providers: [
					ApiMonitoringService,
					{
						provide: API_MONITORING_REQUEST_LOG_REPO,
						useValue: requestLogRepo,
					},
					{
						provide: ApiRequestContextService,
						useValue: contextService,
					},
					{
						provide: API_MONITORING_LOGGER_TOKEN,
						useValue: logger,
					},
				],
			}).compile();

			const sampledService = module.get<ApiMonitoringService>(ApiMonitoringService);

			// Mock Math.random to return 0.6 (above sample rate)
			jest.spyOn(Math, 'random').mockReturnValue(0.6);

			const outcome = await sampledService.logRequest({
				route: '/v1/agents',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 100,
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
				correlationId: 'c',
				timestamp: new Date(),
				hasError: false,
			});

			expect(outcome).toMatchObject({ status: 'skipped', reason: 'sampled' });
			expect(requestLogRepo.create).not.toHaveBeenCalled();

			jest.spyOn(Math, 'random').mockRestore();
		});

		it('returns skipped outcome when actor id is missing', async () => {
			const outcome = await service.logRequest({
				route: '/x',
				method: HttpMethod.GET,
				statusCode: 200,
				latencyMs: 1,
				correlationId: 'c1',
				timestamp: new Date(),
				hasError: false,
			});

			expect(outcome).toMatchObject({ status: 'skipped', reason: 'no_actor_id' });
			expect(requestLogRepo.create).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalled();
		});
	});

	describe('classifyError', () => {
		it('should classify 500 as server error', () => {
			const result = service.classifyError(500);
			expect(result).toBe(ApiErrorClassification.SERVER_ERROR);
		});

		it('should classify 401 as auth error', () => {
			const result = service.classifyError(401);
			expect(result).toBe(ApiErrorClassification.AUTH_ERROR);
		});

		it('should classify 403 as auth error', () => {
			const result = service.classifyError(403);
			expect(result).toBe(ApiErrorClassification.AUTH_ERROR);
		});

		it('should classify 429 as rate limit error', () => {
			const result = service.classifyError(429);
			expect(result).toBe(ApiErrorClassification.RATE_LIMIT_ERROR);
		});

		it('should classify 400 as client error', () => {
			const result = service.classifyError(400);
			expect(result).toBe(ApiErrorClassification.CLIENT_ERROR);
		});

		it('should classify 400 with ValidationError as validation error', () => {
			const error = new Error('Validation failed');
			error.name = 'ValidationError';
			const result = service.classifyError(400, error);
			expect(result).toBe(ApiErrorClassification.VALIDATION_ERROR);
		});

		it('should classify 400 with BadRequestException as validation error', () => {
			const error = new Error('Bad request');
			error.name = 'BadRequestException';
			const result = service.classifyError(400, error);
			expect(result).toBe(ApiErrorClassification.VALIDATION_ERROR);
		});

		it('should classify 200 as unknown error', () => {
			const result = service.classifyError(200);
			expect(result).toBe(ApiErrorClassification.UNKNOWN_ERROR);
		});
	});

	describe('sanitizeErrorMessage', () => {
		it('should remove email addresses', () => {
			const message = 'User john@example.com failed to login';
			const result = service.sanitizeErrorMessage(message);
			expect(result).toBe('User [EMAIL] failed to login');
		});

		it('should remove phone numbers', () => {
			const message = 'Call 555-123-4567 for support';
			const result = service.sanitizeErrorMessage(message);
			expect(result).toBe('Call [PHONE] for support');
		});

		it('should remove SSNs', () => {
			const message = 'SSN: 123-45-6789';
			const result = service.sanitizeErrorMessage(message);
			expect(result).toBe('SSN: [SSN]');
		});

		it('should remove credit card numbers', () => {
			const message = 'Card: 1234-5678-9012-3456';
			const result = service.sanitizeErrorMessage(message);
			expect(result).toBe('Card: [CARD]');
		});

		it('should handle multiple PII types', () => {
			const message = 'Contact john@example.com at 555-123-4567 or SSN 123-45-6789';
			const result = service.sanitizeErrorMessage(message);
			expect(result).toBe('Contact [EMAIL] at [PHONE] or SSN [SSN]');
		});
	});

	describe('extractStackTrace', () => {
		it('should return stack trace for 500 errors', () => {
			const error = new Error('Server error');
			error.stack = 'Error: Server error\n    at test.js:1:1';
			const result = service.extractStackTrace(error, 500);
			expect(result).toBe('Error: Server error\n    at test.js:1:1');
		});

		it('should return undefined for 400 errors', () => {
			const error = new Error('Client error');
			error.stack = 'Error: Client error\n    at test.js:1:1';
			const result = service.extractStackTrace(error, 400);
			expect(result).toBeUndefined();
		});

		it('should return undefined for non-Error objects', () => {
			const result = service.extractStackTrace('string error', 500);
			expect(result).toBeUndefined();
		});

		it('should return undefined for errors without stack', () => {
			const error = new Error('Error without stack');
			delete error.stack;
			const result = service.extractStackTrace(error, 500);
			expect(result).toBeUndefined();
		});
	});

	describe('buildRequestMetadata', () => {
		it('should build metadata from context', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
				timestamp: new Date('2024-01-01T00:00:00Z'),
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
			} as any);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.GET,
				200,
				100,
				'192.168.1.1',
				'Mozilla/5.0',
			);

			expect(result.route).toBe('/v1/agents');
			expect(result.method).toBe(HttpMethod.GET);
			expect(result.statusCode).toBe(200);
			expect(result.latencyMs).toBe(100);
			expect(result.ipAddress).toBe('192.168.1.1');
			expect(result.userAgent).toBe('Mozilla/5.0');
			expect(result.correlationId).toBe('corr-123');
			expect(result.actorId).toBe('actor-123');
			expect(result.actorType).toBe(ApiActorType.USER);
			expect(result.hasError).toBe(false);
			expect(result.retryCount).toBe(0);
		});

		it('should classify errors correctly', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
			} as any);

			const error = new Error('Validation failed');
			error.name = 'ValidationError';

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.POST,
				400,
				50,
				undefined,
				undefined,
				error,
			);

			expect(result.hasError).toBe(true);
			expect(result.errorClassification).toBe(ApiErrorClassification.VALIDATION_ERROR);
			expect(result.errorMessage).toBe('Validation failed');
		});

		it('should extract stack trace for server errors', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
			} as any);

			const error = new Error('Server error');
			error.stack = 'Error: Server error\n    at test.js:1:1';

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.GET,
				500,
				200,
				undefined,
				undefined,
				error,
			);

			expect(result.stackTrace).toBe('Error: Server error\n    at test.js:1:1');
		});

		it('should use default correlation ID when context is missing', () => {
			contextService.getContext.mockReturnValue(undefined);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.GET,
				200,
				100,
			);

			expect(result.correlationId).toBe('unknown');
		});

		it('should calculate request and response sizes', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
			} as any);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.POST,
				200,
				100,
				undefined,
				undefined,
				undefined,
				1024,
				2048,
			);

			expect(result.requestSizeBytes).toBe(1024);
			expect(result.responseSizeBytes).toBe(2048);
		});

		it('should include requestBodySnapshot when provided', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
			} as any);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.POST,
				400,
				10,
				undefined,
				undefined,
				new Error('bad'),
				100,
				undefined,
				'{"id":"x"}',
			);

			expect(result.requestBodySnapshot).toBe('{"id":"x"}');
		});

		it('should include monitoringUserId from async context when set', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
				monitoringUserId: 'mu-99',
			} as any);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.GET,
				200,
				1,
			);

			expect(result.monitoringUserId).toBe('mu-99');
		});

		it('should include sourceApplication when provided', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
			} as any);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.GET,
				200,
				1,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				'TRX',
			);

			expect(result.sourceApplication).toBe('TRX');
		});

		it('should include retryCount when provided', () => {
			contextService.getContext.mockReturnValue({
				correlationId: 'corr-123',
				actorId: 'actor-1',
				actorType: ApiActorType.USER,
			} as any);

			const result = service.buildRequestMetadata(
				'/v1/agents',
				HttpMethod.POST,
				503,
				50,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				3,
			);

			expect(result.retryCount).toBe(3);
		});
	});
});

