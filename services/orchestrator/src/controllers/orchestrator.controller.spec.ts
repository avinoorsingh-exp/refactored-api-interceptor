import { OrchestratorController } from './orchestrator.controller.js';
import { LoggerService } from '../core/logger.service.js';

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
});
