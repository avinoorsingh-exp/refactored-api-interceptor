import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayPlansService } from './pay-plans.service.js';
import type { IPayPlansRepository } from './ports/pay-plans.repository.port.js';
import type { PayPlan, CreatePayPlanInput, UpdatePayPlanInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for PayPlansService
 * Tests create(), findById(), findByName(), update(), findPage() with mocked repository
 * Validates: Requirements 2.4, 2.6, 2.7
 */
describe('PayPlansService', () => {
  let service: PayPlansService;
  let repository: jest.Mocked<IPayPlansRepository>;
  let logger: jest.Mocked<LoggerService>;

  const mockPayPlan: PayPlan = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Standard Plan',
    active: true,
    agentPercentage: 80,
    cap: 16000,
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    } as jest.Mocked<IPayPlansRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    service = new PayPlansService(repository, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreatePayPlanInput = {
      name: 'Premium Plan',
      active: true,
      agentPercentage: 85,
      cap: 20000,
    };

    /**
     * Test successful pay plan creation
     * Validates: Requirements 2.4
     */
    it('should create a new pay plan when name does not exist', async () => {
      const newPayPlan: PayPlan = {
        ...mockPayPlan,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Premium Plan',
        agentPercentage: 85,
        cap: 20000,
      };

      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(newPayPlan);

      const result = await service.create(createDto);

      expect(result).toEqual(newPayPlan);
      expect(repository.findByName).toHaveBeenCalledWith('Premium Plan');
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test duplicate name detection
     * Validates: Requirements 2.6
     */
    it('should throw ConflictException when pay plan name already exists', async () => {
      repository.findByName.mockResolvedValue(mockPayPlan);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('Premium Plan'),
          i18nType: 'agent.payplan.duplicate_name',
        },
      });

      expect(repository.findByName).toHaveBeenCalledWith('Premium Plan');
      expect(repository.create).not.toHaveBeenCalled();
    });

    /**
     * Test error propagation from repository
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database connection failed');
      repository.findByName.mockResolvedValue(null);
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(error);
    });
  });

  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 2.4
     */
    it('should return pay plan when found by ID', async () => {
      repository.findById.mockResolvedValue(mockPayPlan);

      const result = await service.findById(mockPayPlan.id);

      expect(result).toEqual(mockPayPlan);
      expect(repository.findById).toHaveBeenCalledWith(mockPayPlan.id);
    });

    /**
     * Test not found scenario
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when pay plan not found by ID', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent-id'),
          i18nType: 'agent.payplan.not_found',
        },
      });

      expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database error');
      repository.findById.mockRejectedValue(error);

      await expect(service.findById(mockPayPlan.id)).rejects.toThrow(error);
    });
  });

  describe('findByName', () => {
    /**
     * Test successful retrieval by name
     * Validates: Requirements 2.4
     */
    it('should return pay plan when found by name', async () => {
      repository.findByName.mockResolvedValue(mockPayPlan);

      const result = await service.findByName('Standard Plan');

      expect(result).toEqual(mockPayPlan);
      expect(repository.findByName).toHaveBeenCalledWith('Standard Plan');
    });

    /**
     * Test not found scenario
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when pay plan not found by name', async () => {
      repository.findByName.mockResolvedValue(null);

      await expect(service.findByName('Non-existent Plan')).rejects.toThrow(NotFoundException);
      await expect(service.findByName('Non-existent Plan')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('Non-existent Plan'),
          i18nType: 'agent.payplan.not_found',
        },
      });

      expect(repository.findByName).toHaveBeenCalledWith('Non-existent Plan');
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database error');
      repository.findByName.mockRejectedValue(error);

      await expect(service.findByName('Standard Plan')).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    const updateDto: UpdatePayPlanInput = { name: 'Updated Plan', agentPercentage: 90 };

    /**
     * Test successful update
     * Validates: Requirements 2.4
     */
    it('should update pay plan when it exists', async () => {
      const updatedPayPlan: PayPlan = {
        ...mockPayPlan,
        name: 'Updated Plan',
        agentPercentage: 90,
      };

      repository.findById.mockResolvedValue(mockPayPlan);
      repository.findByName.mockResolvedValue(null);
      repository.update.mockResolvedValue(updatedPayPlan);

      const result = await service.update(mockPayPlan.id, updateDto);

      expect(result).toEqual(updatedPayPlan);
      expect(repository.findById).toHaveBeenCalledWith(mockPayPlan.id);
      expect(repository.update).toHaveBeenCalledWith(mockPayPlan.id, updateDto);
    });

    /**
     * Test not found on update
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when updating non-existent pay plan', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateDto)).rejects.toMatchObject({
        response: {
          i18nType: 'agent.payplan.not_found',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate name detection on update
     * Validates: Requirements 2.6
     */
    it('should throw ConflictException when updating to existing name', async () => {
      const updateWithName: UpdatePayPlanInput = { name: 'Existing Plan' };
      const existingPlan: PayPlan = {
        ...mockPayPlan,
        id: 'different-id',
        name: 'Existing Plan',
      };

      repository.findById.mockResolvedValue(mockPayPlan);
      repository.findByName.mockResolvedValue(existingPlan);

      await expect(service.update(mockPayPlan.id, updateWithName)).rejects.toThrow(ConflictException);
      await expect(service.update(mockPayPlan.id, updateWithName)).rejects.toMatchObject({
        response: {
          i18nType: 'agent.payplan.duplicate_name',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test updating to same name (should be allowed)
     */
    it('should allow updating to the same name', async () => {
      const updateWithSameName: UpdatePayPlanInput = { name: 'Standard Plan' };
      const updatedPayPlan: PayPlan = { ...mockPayPlan };

      repository.findById.mockResolvedValue(mockPayPlan);
      repository.findByName.mockResolvedValue(mockPayPlan); // Same pay plan
      repository.update.mockResolvedValue(updatedPayPlan);

      const result = await service.update(mockPayPlan.id, updateWithSameName);

      expect(result).toEqual(updatedPayPlan);
      expect(repository.update).toHaveBeenCalled();
    });

    /**
     * Test update without name change (should skip duplicate check)
     */
    it('should skip duplicate check when name is not being changed', async () => {
      const updateWithoutName: UpdatePayPlanInput = { agentPercentage: 95 };
      const updatedPayPlan: PayPlan = { ...mockPayPlan, agentPercentage: 95 };

      repository.findById.mockResolvedValue(mockPayPlan);
      repository.update.mockResolvedValue(updatedPayPlan);

      const result = await service.update(mockPayPlan.id, updateWithoutName);

      expect(result).toEqual(updatedPayPlan);
      expect(repository.findByName).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(mockPayPlan.id, updateWithoutName);
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database error');
      repository.findById.mockResolvedValue(mockPayPlan);
      repository.findByName.mockResolvedValue(null);
      repository.update.mockRejectedValue(error);

      await expect(service.update(mockPayPlan.id, updateDto)).rejects.toThrow(error);
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 2.4
     */
    it('should return paginated pay plans from repository', async () => {
      const mockPayPlans = [
        { ...mockPayPlan, name: 'Standard Plan' },
        { ...mockPayPlan, id: 'another-id', name: 'Premium Plan' },
      ];

      repository.findPage.mockResolvedValue({
        items: mockPayPlans,
        total: 50,
      });

      const result = await service.findPage({ offset: 0, limit: 25 });

      expect(result.payPlans).toEqual(mockPayPlans);
      expect(result.total).toBe(50);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 }, undefined);
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockPayPlan],
        total: 50,
      });

      const result = await service.findPage({ offset: 25, limit: 25 });

      expect(result.payPlans).toHaveLength(1);
      expect(result.total).toBe(50);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 25, limit: 25 }, undefined);
    });

    /**
     * Test empty result set
     */
    it('should handle empty result set', async () => {
      repository.findPage.mockResolvedValue({
        items: [],
        total: 0,
      });

      const result = await service.findPage({ offset: 0, limit: 25 });

      expect(result.payPlans).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test with filter, sort, and search
     */
    it('should pass filter, sort, and search to repository', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockPayPlan],
        total: 1,
      });

      const query = {
        offset: 0,
        limit: 25,
        filter: 'active:eq:true',
        sort: 'name:ASC',
        search: 'Standard',
      };

      await service.findPage(query);

      expect(repository.findPage).toHaveBeenCalledWith(query, undefined);
    });

    /**
     * Test with field selection
     */
    it('should pass field selection to repository', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockPayPlan],
        total: 1,
      });

      const query = { offset: 0, limit: 25 };
      const selection = { fields: ['id', 'name', 'active'] };

      await service.findPage(query, selection);

      expect(repository.findPage).toHaveBeenCalledWith(query, selection);
    });

    /**
     * Test error propagation
     */
    it('should propagate errors from repository', async () => {
      const error = new Error('Database error');
      repository.findPage.mockRejectedValue(error);

      await expect(service.findPage({ offset: 0, limit: 25 })).rejects.toThrow(error);
    });
  });
});
