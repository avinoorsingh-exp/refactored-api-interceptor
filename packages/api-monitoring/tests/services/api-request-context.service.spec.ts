import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { ApiActorType } from '@exprealty/shared-domain';
import { AsyncContextStorage } from '@exprealty/cache';

describe('ApiRequestContextService', () => {
	let service: ApiRequestContextService;
	let mockGetStore: jest.Mock;
	let mockGetCorrelationId: jest.Mock;

	beforeEach(async () => {
		mockGetStore = AsyncContextStorage.getStore as jest.Mock;
		mockGetCorrelationId = AsyncContextStorage.getCorrelationId as jest.Mock;
		mockGetStore.mockReset();
		mockGetCorrelationId.mockReset();

		const module = await Test.createTestingModule({
			providers: [ApiRequestContextService],
		}).compile();

		service = module.get<ApiRequestContextService>(ApiRequestContextService);
	});

	describe('getContext', () => {
		it('should return context from AsyncContextStorage', () => {
			const mockContext = {
				correlationId: 'corr-123',
				actorId: 'actor-123',
				actorType: ApiActorType.USER,
			};

			mockGetStore.mockReturnValue(mockContext);

			const result = service.getContext();

			expect(result).toBe(mockContext);
		});

		it('should return undefined when context is not available', () => {
			mockGetStore.mockReturnValue(undefined);

			const result = service.getContext();

			expect(result).toBeUndefined();
		});
	});

	describe('getCorrelationId', () => {
		it('should return correlation ID from AsyncContextStorage', () => {
			mockGetCorrelationId.mockReturnValue('corr-123');

			const result = service.getCorrelationId();

			expect(result).toBe('corr-123');
		});

		it('should return undefined when correlation ID is not available', () => {
			mockGetCorrelationId.mockReturnValue(undefined);

			const result = service.getCorrelationId();

			expect(result).toBeUndefined();
		});
	});

	describe('getActorId', () => {
		it('should return actor ID from context', () => {
			mockGetStore.mockReturnValue({
				actorId: 'actor-123',
			});

			const result = service.getActorId();

			expect(result).toBe('actor-123');
		});

		it('should return undefined when context is not available', () => {
			mockGetStore.mockReturnValue(undefined);

			const result = service.getActorId();

			expect(result).toBeUndefined();
		});

		it('should return undefined when actorId is not in context', () => {
			mockGetStore.mockReturnValue({});

			const result = service.getActorId();

			expect(result).toBeUndefined();
		});
	});

	describe('getActorType', () => {
		it('should return actor type from context', () => {
			mockGetStore.mockReturnValue({
				actorType: ApiActorType.USER,
			});

			const result = service.getActorType();

			expect(result).toBe(ApiActorType.USER);
		});

		it('should return undefined when context is not available', () => {
			mockGetStore.mockReturnValue(undefined);

			const result = service.getActorType();

			expect(result).toBeUndefined();
		});
	});

	describe('updateActor', () => {
		it('should update actor in context', () => {
			const mockContext: any = {
				correlationId: 'corr-123',
			};

			mockGetStore.mockReturnValue(mockContext);

			service.updateActor('actor-123', ApiActorType.USER);

			expect(mockContext.actorId).toBe('actor-123');
			expect(mockContext.actorType).toBe(ApiActorType.USER);
		});

		it('should not throw when context is not available', () => {
			mockGetStore.mockReturnValue(undefined);

			expect(() => {
				service.updateActor('actor-123', ApiActorType.USER);
			}).not.toThrow();
		});
	});

	describe('setStartTime', () => {
		it('should set start time in context', () => {
			const mockContext: any = {
				correlationId: 'corr-123',
			};

			mockGetStore.mockReturnValue(mockContext);

			service.setStartTime();

			expect(mockContext.startTime).toBeDefined();
			expect(typeof mockContext.startTime).toBe('number');
		});

		it('should not throw when context is not available', () => {
			mockGetStore.mockReturnValue(undefined);

			expect(() => {
				service.setStartTime();
			}).not.toThrow();
		});
	});

	describe('getStartTime', () => {
		it('should return start time from context', () => {
			const startTime = Date.now();
			mockGetStore.mockReturnValue({
				startTime,
			});

			const result = service.getStartTime();

			expect(result).toBe(startTime);
		});

		it('should return undefined when context is not available', () => {
			mockGetStore.mockReturnValue(undefined);

			const result = service.getStartTime();

			expect(result).toBeUndefined();
		});
	});
});

