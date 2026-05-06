import { Test } from '@nestjs/testing';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { ApiActorType } from '../../src/domain/api-monitoring.types.js';
import {
	API_MONITORING_ASYNC_CONTEXT,
	type ApiMonitoringRequestStore,
	type IApiMonitoringAsyncContext,
} from '../../src/interfaces/async-context.port.js';

describe('ApiRequestContextService', () => {
	let service: ApiRequestContextService;
	let mockAsyncContext: jest.Mocked<IApiMonitoringAsyncContext>;

	beforeEach(async () => {
		mockAsyncContext = {
			getStore: jest.fn(),
			getCorrelationId: jest.fn(),
		};

		const module = await Test.createTestingModule({
			providers: [
				{ provide: API_MONITORING_ASYNC_CONTEXT, useValue: mockAsyncContext },
				ApiRequestContextService,
			],
		}).compile();

		service = module.get<ApiRequestContextService>(ApiRequestContextService);
	});

	describe('getContext', () => {
		it('should return context from async context port', () => {
			const mockContext = {
				correlationId: 'corr-123',
				timestamp: Date.now(),
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
			};

			mockAsyncContext.getStore.mockReturnValue(mockContext);

			const result = service.getContext();

			expect(result).toBe(mockContext);
		});

		it('should return undefined when context is not available', () => {
			mockAsyncContext.getStore.mockReturnValue(undefined);

			const result = service.getContext();

			expect(result).toBeUndefined();
		});
	});

	describe('getCorrelationId', () => {
		it('should return correlation ID from async context port', () => {
			mockAsyncContext.getCorrelationId.mockReturnValue('corr-123');

			const result = service.getCorrelationId();

			expect(result).toBe('corr-123');
		});

		it('should return undefined when correlation ID is not available', () => {
			mockAsyncContext.getCorrelationId.mockReturnValue(undefined);

			const result = service.getCorrelationId();

			expect(result).toBeUndefined();
		});
	});

	describe('getActorId', () => {
		it('should return actor ID from context', () => {
			mockAsyncContext.getStore.mockReturnValue({
				correlationId: 'c',
				timestamp: 1,
				actorId: 'actor-123',
			});

			const result = service.getActorId();

			expect(result).toBe('actor-123');
		});

		it('should return undefined when context is not available', () => {
			mockAsyncContext.getStore.mockReturnValue(undefined);

			const result = service.getActorId();

			expect(result).toBeUndefined();
		});

		it('should return undefined when actorId is not in context', () => {
			mockAsyncContext.getStore.mockReturnValue({ correlationId: 'c', timestamp: 1 });

			const result = service.getActorId();

			expect(result).toBeUndefined();
		});
	});

	describe('getActorType', () => {
		it('should return actor type from context', () => {
			mockAsyncContext.getStore.mockReturnValue({
				correlationId: 'c',
				timestamp: 1,
				actorType: ApiActorType.USER,
			});

			const result = service.getActorType();

			expect(result).toBe(ApiActorType.USER);
		});

		it('should return undefined when context is not available', () => {
			mockAsyncContext.getStore.mockReturnValue(undefined);

			const result = service.getActorType();

			expect(result).toBeUndefined();
		});
	});

	describe('updateActor', () => {
		it('should update actor in context', () => {
			const mockContext: ApiMonitoringRequestStore = {
				correlationId: 'corr-123',
				timestamp: 1,
			};

			mockAsyncContext.getStore.mockReturnValue(mockContext);

			service.updateActor('actor-123', ApiActorType.USER);

			expect(mockContext.actorId).toBe('actor-123');
			expect(mockContext.actorType).toBe(ApiActorType.USER);
		});

		it('should not throw when context is not available', () => {
			mockAsyncContext.getStore.mockReturnValue(undefined);

			expect(() => {
				service.updateActor('actor-123', ApiActorType.USER);
			}).not.toThrow();
		});
	});

	describe('setStartTime', () => {
		it('should set start time in context', () => {
			const mockContext: ApiMonitoringRequestStore = {
				correlationId: 'corr-123',
				timestamp: 1,
			};

			mockAsyncContext.getStore.mockReturnValue(mockContext);

			service.setStartTime();

			expect(mockContext.startTime).toBeDefined();
			expect(typeof mockContext.startTime).toBe('number');
		});

		it('should not throw when context is not available', () => {
			mockAsyncContext.getStore.mockReturnValue(undefined);

			expect(() => {
				service.setStartTime();
			}).not.toThrow();
		});
	});

	describe('getStartTime', () => {
		it('should return start time from context', () => {
			const startTime = Date.now();
			mockAsyncContext.getStore.mockReturnValue({
				correlationId: 'c',
				timestamp: 1,
				startTime,
			});

			const result = service.getStartTime();

			expect(result).toBe(startTime);
		});

		it('should return undefined when context is not available', () => {
			mockAsyncContext.getStore.mockReturnValue(undefined);

			const result = service.getStartTime();

			expect(result).toBeUndefined();
		});
	});
});
