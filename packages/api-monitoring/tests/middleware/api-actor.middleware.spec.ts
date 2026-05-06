import { Test } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { ApiActorMiddleware } from '../../src/middleware/api-actor.middleware.js';
import { ApiActorService } from '../../src/services/api-actor.service.js';
import { ApiMonitoringUserService } from '../../src/services/api-monitoring-user.service.js';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { ApiActorType } from '../../src/domain/api-monitoring.types.js';
import { API_MONITORING_LOGGER_TOKEN } from '../../src/interfaces/logger.interface.js';
import type { IApiMonitoringLogger } from '../../src/interfaces/logger.interface.js';

/** Express `Request` plus optional auth fields the middleware reads (same shape as production augmentations). */
type MockActorRequest = Partial<Request> & {
	user?: { id?: string; email?: string; username?: string };
	apiKey?: { id?: string; name?: string };
	serviceAccount?: { id?: string; name?: string };
};

describe('ApiActorMiddleware', () => {
	let middleware: ApiActorMiddleware;
	let actorService: jest.Mocked<ApiActorService>;
	let monitoringUserService: jest.Mocked<Pick<ApiMonitoringUserService, 'upsertForUserActor'>>;
	let contextService: jest.Mocked<ApiRequestContextService>;
	let logger: jest.Mocked<IApiMonitoringLogger>;
	let mockRequest: MockActorRequest;
	let mockResponse: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(async () => {
		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		} as any;

		actorService = {
			getOrCreateActor: jest.fn(),
		} as any;

		monitoringUserService = {
			upsertForUserActor: jest.fn().mockResolvedValue({ id: 'monitoring-user-uuid-1' }),
		};

		contextService = {
			updateActor: jest.fn(),
			updateMonitoringUser: jest.fn(),
		} as any;

		mockRequest = {
			ip: '192.168.1.1',
			get: jest.fn().mockReturnValue(undefined),
		};

		mockResponse = {};

		mockNext = jest.fn();

		const module = await Test.createTestingModule({
			providers: [
				ApiActorMiddleware,
				{
					provide: ApiActorService,
					useValue: actorService,
				},
				{
					provide: ApiMonitoringUserService,
					useValue: monitoringUserService,
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

		middleware = module.get<ApiActorMiddleware>(ApiActorMiddleware);
	});

	describe('use', () => {
		it('should extract and create user actor', async () => {
			const mockActor = {
				id: 'actor-123',
				type: ApiActorType.USER,
			} as any;

			actorService.getOrCreateActor.mockResolvedValue(mockActor);

			mockRequest.user = {
				id: 'user-123',
				email: 'user@example.com',
				username: 'user',
			};

			await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

			expect(actorService.getOrCreateActor).toHaveBeenCalledWith(
				ApiActorType.USER,
				'user@example.com',
				expect.objectContaining({
					userId: 'user-123',
					username: 'user',
					email: 'user@example.com',
				}),
			);
			expect(contextService.updateActor).toHaveBeenCalledWith('actor-123', ApiActorType.USER);
			expect(monitoringUserService.upsertForUserActor).toHaveBeenCalledWith({
				externalId: 'user-123',
				email: 'user@example.com',
				actorId: 'actor-123',
			});
			expect(contextService.updateMonitoringUser).toHaveBeenCalledWith('monitoring-user-uuid-1');
			expect(mockNext).toHaveBeenCalled();
		});

		it('should extract and create API key actor', async () => {
			const mockActor = {
				id: 'actor-456',
				type: ApiActorType.API_KEY,
			} as any;

			actorService.getOrCreateActor.mockResolvedValue(mockActor);

			mockRequest.apiKey = {
				id: 'api-key-123',
				name: 'My API Key',
			};

			await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

			expect(monitoringUserService.upsertForUserActor).not.toHaveBeenCalled();

			expect(actorService.getOrCreateActor).toHaveBeenCalledWith(
				ApiActorType.API_KEY,
				'My API Key',
				expect.objectContaining({
					apiKeyId: 'api-key-123',
					apiKeyName: 'My API Key',
				}),
			);
			expect(contextService.updateActor).toHaveBeenCalledWith('actor-456', ApiActorType.API_KEY);
			expect(mockNext).toHaveBeenCalled();
		});

		it('should extract and create service account actor', async () => {
			const mockActor = {
				id: 'actor-789',
				type: ApiActorType.SERVICE_ACCOUNT,
			} as any;

			actorService.getOrCreateActor.mockResolvedValue(mockActor);

			mockRequest.serviceAccount = {
				id: 'service-123',
				name: 'My Service',
			};

			await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

			expect(monitoringUserService.upsertForUserActor).not.toHaveBeenCalled();

			expect(actorService.getOrCreateActor).toHaveBeenCalledWith(
				ApiActorType.SERVICE_ACCOUNT,
				'My Service',
				expect.objectContaining({
					serviceAccountId: 'service-123',
				}),
			);
			expect(contextService.updateActor).toHaveBeenCalledWith('actor-789', ApiActorType.SERVICE_ACCOUNT);
			expect(mockNext).toHaveBeenCalled();
		});

		it('should create anonymous actor when no auth present', async () => {
			const mockActor = {
				id: 'actor-anon',
				type: ApiActorType.ANONYMOUS,
			} as any;

			actorService.getOrCreateActor.mockResolvedValue(mockActor);

			await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

			expect(actorService.getOrCreateActor).toHaveBeenCalledWith(
				ApiActorType.ANONYMOUS,
				'ANONYMOUS',
				{ ip: '192.168.1.1' },
			);
			expect(contextService.updateActor).toHaveBeenCalledWith('actor-anon', ApiActorType.ANONYMOUS);
			expect(monitoringUserService.upsertForUserActor).not.toHaveBeenCalled();
			expect(mockNext).toHaveBeenCalled();
		});

		it('should handle errors gracefully and continue', async () => {
			actorService.getOrCreateActor.mockRejectedValue(new Error('Database error'));

			await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

			expect(logger.error).toHaveBeenCalledWith(
				'Failed to attribute actor',
				expect.objectContaining({
					error: 'Database error',
				}),
			);
			expect(mockNext).toHaveBeenCalled(); // Should still call next
		});

		it('should prioritize user over API key', async () => {
			const mockActor = {
				id: 'actor-user',
				type: ApiActorType.USER,
			} as any;

			actorService.getOrCreateActor.mockResolvedValue(mockActor);

			mockRequest.user = { id: 'user-123', email: 'user@example.com' };
			mockRequest.apiKey = { id: 'api-key-123' };

			await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

			expect(actorService.getOrCreateActor).toHaveBeenCalledWith(
				ApiActorType.USER,
				'user@example.com',
				expect.any(Object),
			);
			expect(actorService.getOrCreateActor).toHaveBeenCalledTimes(1);
			expect(monitoringUserService.upsertForUserActor).toHaveBeenCalled();
			expect(contextService.updateMonitoringUser).toHaveBeenCalledWith('monitoring-user-uuid-1');
		});
	});
});

