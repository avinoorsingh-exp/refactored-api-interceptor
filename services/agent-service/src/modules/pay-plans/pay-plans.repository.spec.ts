import { PayPlansTypeOrmRepository } from './pay-plans.repository.js';
import { PayPlanEntity } from '@exprealty/database';
import type { PayPlan } from '@exprealty/shared-domain';
import {
  createMockTypeOrmRepository,
  createMockQueryService,
  createMockProjectionService,
} from '../../../../../test/utils/mock-factories.js';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for PayPlansTypeOrmRepository
 * Tests all CRUD operations including findByName()
 * Validates: Requirements 3.4
 */
describe('PayPlansTypeOrmRepository', () => {
  let repository: PayPlansTypeOrmRepository;
  let mockTypeOrmRepo: ReturnType<typeof createMockTypeOrmRepository> & { findOneOrFail: jest.Mock };
  let mockQueryService: ReturnType<typeof createMockQueryService>;
  let mockProjectionService: ReturnType<typeof createMockProjectionService>;
  let mockLogger: jest.Mocked<LoggerService>;

  const mockPayPlanEntity: PayPlanEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Standard Plan',
    active: true,
    agentPercentage: 80,
    cap: 16000,
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
    payPlanVariants: [],
    paymentSettings: [],
  } as unknown as PayPlanEntity;

  const expectedDomainPayPlan: PayPlan = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Standard Plan',
    active: true,
    agentPercentage: 80,
    cap: 16000,
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
    payPlanVariants: [],
    paymentSettings: [],
  };

  beforeEach(() => {
    mockTypeOrmRepo = createMockTypeOrmRepository() as any;
    mockTypeOrmRepo.findOneOrFail = jest.fn();
    mockQueryService = createMockQueryService();
    mockProjectionService = createMockProjectionService();
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    repository = new PayPlansTypeOrmRepository(
      mockTypeOrmRepo as any,
      mockQueryService as any,
      mockLogger,
      mockProjectionService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 3.4
     */
    it('should return mapped domain pay plan when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockPayPlanEntity);

      const result = await repository.findById(mockPayPlanEntity.id as string);

      expect(result).toEqual(expectedDomainPayPlan);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPayPlanEntity.id },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when pay plan not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    /**
     * Test ID is passed as-is to query
     */
    it('should pass ID as-is to query', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockPayPlanEntity);

      await repository.findById('test-uuid-42');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'test-uuid-42' },
      });
    });
  });

  describe('findByName', () => {
    /**
     * Test successful retrieval by name
     * Validates: Requirements 3.4
     */
    it('should return mapped domain pay plan when found by name', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockPayPlanEntity);

      const result = await repository.findByName('Standard Plan');

      expect(result).toEqual(expectedDomainPayPlan);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'Standard Plan' },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when pay plan not found by name', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 3.4
     */
    it('should return paginated results with mapped domain pay plans', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockPayPlanEntity], 1]);

      const result = await repository.findPage({ offset: 0, limit: 25 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainPayPlan);
      expect(result.total).toBe(1);
    });

    /**
     * Test with query parameters
     */
    it('should apply query service normalization', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findPage({
        offset: 10,
        limit: 50,
        filter: 'active:eq:true',
        sort: 'name:ASC',
      });

      expect(mockQueryService.normalizeWithValidation).toHaveBeenCalled();
      expect(mockQueryService.applyAllWithStrategies).toHaveBeenCalled();
    });

    /**
     * Test default sort by name ASC
     */
    it('should apply default sort by name ASC when no sort specified', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      mockQueryService.normalizeWithValidation.mockReturnValue({
        offset: 0,
        limit: 25,
        filter: { conditions: [], logicalOperator: 'AND' },
        sort: { conditions: [] },
        search: { query: '', fields: [] },
      });

      await repository.findPage({ offset: 0, limit: 25 });

      expect(mockQb.orderBy).toHaveBeenCalledWith('pay_plan.name', 'ASC');
    });

    /**
     * Test empty result set
     */
    it('should handle empty result set', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findPage({ offset: 0, limit: 25 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test pagination skip and take
     */
    it('should apply pagination skip and take', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      mockQueryService.normalizeWithValidation.mockReturnValue({
        offset: 10,
        limit: 25,
        filter: { conditions: [], logicalOperator: 'AND' },
        sort: { conditions: [] },
        search: { query: '', fields: [] },
      });

      await repository.findPage({ offset: 10, limit: 25 });

      expect(mockQb.skip).toHaveBeenCalledWith(10);
      expect(mockQb.take).toHaveBeenCalledWith(25);
    });
  });

  describe('create', () => {
    /**
     * Test pay plan creation
     * Validates: Requirements 3.4
     */
    it('should create and return mapped domain pay plan', async () => {
      const createData = {
        name: 'Premium Plan',
        active: true,
        agentPercentage: 85,
        cap: 20000,
      };

      const savedEntity = {
        ...mockPayPlanEntity,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Premium Plan',
        agentPercentage: 85,
        cap: 20000,
      };

      mockTypeOrmRepo.create.mockReturnValue(savedEntity);
      mockTypeOrmRepo.save.mockResolvedValue(savedEntity);

      const result = await repository.create(createData as any);

      expect(result.name).toBe('Premium Plan');
      expect(result.id).toBe('660e8400-e29b-41d4-a716-446655440001');
      expect(result.agentPercentage).toBe(85);
      expect(result.cap).toBe(20000);
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    /**
     * Test pay plan update
     * Validates: Requirements 3.4
     */
    it('should update and return mapped domain pay plan', async () => {
      const updateData = { name: 'Updated Plan', agentPercentage: 90 };
      const updatedEntity = {
        ...mockPayPlanEntity,
        name: 'Updated Plan',
        agentPercentage: 90,
      };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      // The base repository uses findOne after update, not findOneOrFail
      mockTypeOrmRepo.findOne.mockResolvedValue(updatedEntity);

      const result = await repository.update(mockPayPlanEntity.id as string, updateData);

      expect(result.name).toBe('Updated Plan');
      expect(result.agentPercentage).toBe(90);
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: mockPayPlanEntity.id },
        updateData,
      );
    });

    /**
     * Test update with entity not found after update
     */
    it('should throw error when entity not found after update', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(
        repository.update('non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow('Entity with id non-existent-id not found after update');
    });
  });

  describe('delete', () => {
    /**
     * Test pay plan deletion
     * Validates: Requirements 3.4
     */
    it('should delete pay plan by id', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete(mockPayPlanEntity.id as string);

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith({ id: mockPayPlanEntity.id });
    });
  });

  describe('mapToDomain (via findById)', () => {
    /**
     * Test entity to domain mapping
     * Validates: Requirements 3.4
     */
    it('should correctly map all entity fields to domain model', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockPayPlanEntity);

      const result = await repository.findById(mockPayPlanEntity.id as string);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockPayPlanEntity.id);
      expect(result!.name).toBe(mockPayPlanEntity.name);
      expect(result!.active).toBe(mockPayPlanEntity.active);
      expect(result!.agentPercentage).toBe(Number(mockPayPlanEntity.agentPercentage));
      expect(result!.cap).toBe(Number(mockPayPlanEntity.cap));
      expect(result!.created).toEqual(mockPayPlanEntity.created);
      expect(result!.lastModified).toEqual(mockPayPlanEntity.lastModified);
      expect(result!.modifiedBy).toBe(mockPayPlanEntity.modifiedBy);
    });

    /**
     * Test numeric conversion for decimal fields
     */
    it('should convert decimal fields to numbers', async () => {
      const entityWithStringDecimals = {
        ...mockPayPlanEntity,
        agentPercentage: '85.5' as any,
        cap: '25000.00' as any,
      };
      mockTypeOrmRepo.findOne.mockResolvedValue(entityWithStringDecimals);

      const result = await repository.findById(mockPayPlanEntity.id as string);

      expect(result!.agentPercentage).toBe(85.5);
      expect(result!.cap).toBe(25000);
      expect(typeof result!.agentPercentage).toBe('number');
      expect(typeof result!.cap).toBe('number');
    });
  });
});
