import { ApiRequestContextService } from './api-request-context.service.js';
import { ApiActorType } from '@exprealty/shared-domain';
import { AsyncContextStorage, RequestContext } from '@exprealty/cache';

/**
 * Unit tests for ApiRequestContextService
 * 
 * Tests request context management with actor attribution
 * for API monitoring and security purposes.
 */
describe('ApiRequestContextService', () => {
	let service: ApiRequestContextService;

	beforeEach(() => {
		service = new ApiRequestContextService();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getContext', () => {
		it('should return undefined when not in a context', () => {
			const result = service.getContext();
			expect(result).toBeUndefined();
		});

		it('should return context when inside AsyncContextStorage.run', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-123',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				const result = service.getContext();
				expect(result).toBeDefined();
				expect(result?.correlationId).toBe('test-123');
			});
		});

		it('should return extended context with actor information', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-456',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				service.updateActor('user-123', 'user');
				const result = service.getContext();
				expect(result).toBeDefined();
				expect(result?.correlationId).toBe('test-456');
				expect((result as any).actorId).toBe('user-123');
				expect((result as any).actorType).toBe('user');
			});
		});
	});

	describe('getCorrelationId', () => {
		it('should return undefined when not in a context', () => {
			const result = service.getCorrelationId();
			expect(result).toBeUndefined();
		});

		it('should return correlation ID from context', () => {
			const mockContext: RequestContext = {
				correlationId: 'correlation-789',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				const result = service.getCorrelationId();
				expect(result).toBe('correlation-789');
			});
		});
	});

	describe('getActorId', () => {
		it('should return undefined when not in a context', () => {
			const result = service.getActorId();
			expect(result).toBeUndefined();
		});

		it('should return undefined when actor ID is not set', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-actor',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				const result = service.getActorId();
				expect(result).toBeUndefined();
			});
		});

		it('should return actor ID when set', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-actor',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				service.updateActor('actor-123', 'service');
				const result = service.getActorId();
				expect(result).toBe('actor-123');
			});
		});
	});

	describe('getActorType', () => {
		it('should return undefined when not in a context', () => {
			const result = service.getActorType();
			expect(result).toBeUndefined();
		});

		it('should return undefined when actor type is not set', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-type',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				const result = service.getActorType();
				expect(result).toBeUndefined();
			});
		});

		it('should return actor type when set', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-type',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				service.updateActor('actor-456', 'system');
				const result = service.getActorType();
				expect(result).toBe('system');
			});
		});

		it('should return all valid actor types', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-types',
				timestamp: Date.now(),
			};

			const actorTypes: ApiActorType[] = ['user', 'service', 'system'];

			actorTypes.forEach((actorType) => {
				AsyncContextStorage.run(mockContext, () => {
					service.updateActor('actor-789', actorType);
					const result = service.getActorType();
					expect(result).toBe(actorType);
				});
			});
		});
	});

	describe('updateActor', () => {
		it('should not throw when not in a context', () => {
			expect(() => {
				service.updateActor('user-123', 'user');
			}).not.toThrow();
		});

		it('should update actor information in context', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-update',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				service.updateActor('user-456', 'user');
				const actorId = service.getActorId();
				const actorType = service.getActorType();
				expect(actorId).toBe('user-456');
				expect(actorType).toBe('user');
			});
		});

		it('should overwrite existing actor information', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-overwrite',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				service.updateActor('user-123', 'user');
				expect(service.getActorId()).toBe('user-123');
				expect(service.getActorType()).toBe('user');

				service.updateActor('service-456', 'service');
				expect(service.getActorId()).toBe('service-456');
				expect(service.getActorType()).toBe('service');
			});
		});

		it('should handle all actor types', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-all-types',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				service.updateActor('user-1', 'user');
				expect(service.getActorType()).toBe('user');

				service.updateActor('service-1', 'service');
				expect(service.getActorType()).toBe('service');

				service.updateActor('system-1', 'system');
				expect(service.getActorType()).toBe('system');
			});
		});
	});

	describe('setStartTime', () => {
		it('should not throw when not in a context', () => {
			expect(() => {
				service.setStartTime();
			}).not.toThrow();
		});

		it('should set start time in context', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-start-time',
				timestamp: Date.now(),
			};

			const beforeTime = Date.now();

			AsyncContextStorage.run(mockContext, () => {
				service.setStartTime();
				const startTime = service.getStartTime();
				expect(startTime).toBeDefined();
				expect(startTime).toBeGreaterThanOrEqual(beforeTime);
				expect(startTime).toBeLessThanOrEqual(Date.now());
			});
		});

		it('should overwrite existing start time', async () => {
			const mockContext: RequestContext = {
				correlationId: 'test-overwrite-time',
				timestamp: Date.now(),
			};

			await new Promise<void>((resolve) => {
				AsyncContextStorage.run(mockContext, () => {
					service.setStartTime();
					const firstTime = service.getStartTime();

					// Wait a bit to ensure different timestamp
					setTimeout(() => {
						service.setStartTime();
						const secondTime = service.getStartTime();
						expect(secondTime).toBeDefined();
						expect(secondTime).toBeGreaterThan(firstTime!);
						resolve();
					}, 10);
				});
			});
		});
	});

	describe('getStartTime', () => {
		it('should return undefined when not in a context', () => {
			const result = service.getStartTime();
			expect(result).toBeUndefined();
		});

		it('should return undefined when start time is not set', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-no-time',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				const result = service.getStartTime();
				expect(result).toBeUndefined();
			});
		});

		it('should return start time when set', () => {
			const mockContext: RequestContext = {
				correlationId: 'test-get-time',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				const expectedTime = Date.now();
				service.setStartTime();
				const result = service.getStartTime();
				expect(result).toBeDefined();
				expect(result).toBeGreaterThanOrEqual(expectedTime);
			});
		});
	});

	describe('integration scenarios', () => {
		it('should handle complete request lifecycle', () => {
			const mockContext: RequestContext = {
				correlationId: 'lifecycle-test',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(mockContext, () => {
				// Set start time
				service.setStartTime();
				expect(service.getStartTime()).toBeDefined();

				// Update actor
				service.updateActor('user-999', 'user');
				expect(service.getActorId()).toBe('user-999');
				expect(service.getActorType()).toBe('user');

				// Verify correlation ID
				expect(service.getCorrelationId()).toBe('lifecycle-test');

				// Verify context contains all information
				const context = service.getContext();
				expect(context).toBeDefined();
				expect(context?.correlationId).toBe('lifecycle-test');
				expect((context as any).actorId).toBe('user-999');
				expect((context as any).actorType).toBe('user');
				expect((context as any).startTime).toBeDefined();
			});
		});

		it('should isolate contexts between different requests', () => {
			const context1: RequestContext = {
				correlationId: 'request-1',
				timestamp: Date.now(),
			};

			const context2: RequestContext = {
				correlationId: 'request-2',
				timestamp: Date.now(),
			};

			AsyncContextStorage.run(context1, () => {
				service.updateActor('user-1', 'user');
				service.setStartTime();
				expect(service.getCorrelationId()).toBe('request-1');
				expect(service.getActorId()).toBe('user-1');
			});

			AsyncContextStorage.run(context2, () => {
				service.updateActor('user-2', 'service');
				service.setStartTime();
				expect(service.getCorrelationId()).toBe('request-2');
				expect(service.getActorId()).toBe('user-2');
			});
		});
	});
});

