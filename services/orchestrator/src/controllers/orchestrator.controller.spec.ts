import { OrchestratorController } from './orchestrator.controller.js';
import { LoggerService } from '../core/logger.service.js';
import { AsyncContextStorage, CorrelationIdHelper } from '@exprealty/cache';

describe('OrchestratorController', () => {
  let controller: OrchestratorController;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    controller = new OrchestratorController(mockLogger);
  });

  describe('health', () => {
    it('should return health status with ok', () => {
      const result = controller.health();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'orchestrator');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return ISO timestamp format', () => {
      const result = controller.health();
      const timestamp = new Date(result.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });

  describe('Correlation ID Integration', () => {
    /**
     * Validates: Requirements 3.1, 3.2, 10.4
     * Test that controller can access correlation ID via AsyncContextStorage
     */
    it('should access correlation ID from AsyncContextStorage within controller context', async () => {
      const testCorrelationId = 'test-orchestrator-correlation-123';

      // Run the controller method within a correlation context
      await CorrelationIdHelper.runInContext(
        testCorrelationId,
        { requestPath: '/health', method: 'GET' },
        async () => {
          // Verify correlation ID is accessible within the context
          const correlationId = AsyncContextStorage.getCorrelationId();
          expect(correlationId).toBe(testCorrelationId);

          // Execute controller method
          const result = controller.health();

          // Verify result is correct
          expect(result).toHaveProperty('status', 'ok');
          expect(result).toHaveProperty('service', 'orchestrator');

          // Verify correlation ID is still accessible after controller execution
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
        }
      );
    });

    /**
     * Validates: Requirements 3.1, 3.2, 10.4
     * Test that correlation ID persists through async operations
     */
    it('should maintain correlation ID through async operations', async () => {
      const testCorrelationId = 'test-orchestrator-async-456';

      await CorrelationIdHelper.runInContext(
        testCorrelationId,
        { requestPath: '/health', method: 'GET' },
        async () => {
          // Verify correlation ID before async operation
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);

          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify correlation ID persists after async operation
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);

          // Execute controller method
          const result = controller.health();
          expect(result).toHaveProperty('status', 'ok');

          // Verify correlation ID still accessible
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
        }
      );
    });

    /**
     * Validates: Requirements 3.1, 3.2, 10.4
     * Test that correlation ID is undefined outside of context
     */
    it('should return undefined when accessing correlation ID outside context', () => {
      // Outside of any correlation context
      const correlationId = AsyncContextStorage.getCorrelationId();
      expect(correlationId).toBeUndefined();
    });

    /**
     * Validates: Requirements 3.1, 3.2, 10.4
     * Test that multiple concurrent contexts maintain isolation
     */
    it('should maintain correlation ID isolation between concurrent operations', async () => {
      const correlationId1 = 'orchestrator-concurrent-1';
      const correlationId2 = 'orchestrator-concurrent-2';

      // Execute two concurrent operations with different correlation IDs
      const [result1, result2] = await Promise.all([
        CorrelationIdHelper.runInContext(
          correlationId1,
          { requestPath: '/health', method: 'GET' },
          async () => {
            // Verify this context has the correct correlation ID
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId1);

            // Add small delay to ensure concurrency
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify correlation ID hasn't changed
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId1);

            return controller.health();
          }
        ),
        CorrelationIdHelper.runInContext(
          correlationId2,
          { requestPath: '/health', method: 'GET' },
          async () => {
            // Verify this context has the correct correlation ID
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId2);

            // Add small delay to ensure concurrency
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify correlation ID hasn't changed
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId2);

            return controller.health();
          }
        ),
      ]);

      expect(result1).toHaveProperty('status', 'ok');
      expect(result2).toHaveProperty('status', 'ok');
    });

    /**
     * Validates: Requirements 3.1, 3.2, 10.4
     * Test that correlation ID context is established before controller execution
     */
    it('should have correlation ID available at the start of controller method', async () => {
      const testCorrelationId = 'test-orchestrator-start-789';

      await CorrelationIdHelper.runInContext(
        testCorrelationId,
        { requestPath: '/health', method: 'GET' },
        async () => {
          // Correlation ID should be immediately accessible
          const correlationIdAtStart = AsyncContextStorage.getCorrelationId();
          expect(correlationIdAtStart).toBe(testCorrelationId);

          // Execute controller
          const result = controller.health();

          // Verify result
          expect(result).toHaveProperty('status', 'ok');

          // Correlation ID should still be accessible
          const correlationIdAtEnd = AsyncContextStorage.getCorrelationId();
          expect(correlationIdAtEnd).toBe(testCorrelationId);
        }
      );
    });
  });
});
