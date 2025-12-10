import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './app.controller.js';

/**
 * Unit tests for AgentController (app.controller)
 * Tests health endpoint returns correct status
 * Validates: Requirements 1.6
 */
describe('AgentController', () => {
  let controller: AgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
    }).compile();

    controller = module.get<AgentController>(AgentController);
  });

  describe('GET /v1/agent/health', () => {
    /**
     * Test health endpoint returns correct status
     * Validates: Requirements 1.6
     */
    it('should return health status with ok status', () => {
      const result = controller.health();

      expect(result.status).toBe('ok');
    });

    it('should return health status with service name', () => {
      const result = controller.health();

      expect(result.service).toBe('agent-service');
    });

    it('should return health status with valid ISO timestamp', () => {
      const beforeCall = new Date().toISOString();
      const result = controller.health();
      const afterCall = new Date().toISOString();

      expect(result.timestamp).toBeDefined();
      // Verify timestamp is a valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
      // Verify timestamp is within the call window
      expect(result.timestamp >= beforeCall).toBe(true);
      expect(result.timestamp <= afterCall).toBe(true);
    });

    it('should return object with all required fields', () => {
      const result = controller.health();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('timestamp');
      expect(Object.keys(result)).toHaveLength(3);
    });
  });
});
