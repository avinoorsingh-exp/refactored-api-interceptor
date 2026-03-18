import { RegionsTypeOrmRepository } from './regions.repository.js';
import { RegionEntity } from '@exprealty/database';
import type { Region } from '@exprealty/shared-domain';
import {
  createMockTypeOrmRepository,
  createMockQueryService,
} from '../../../../../test/utils/mock-factories.js';

/**
 * Unit tests for RegionsTypeOrmRepository
 * Tests all CRUD operations including findByNormalizedName()
 * Validates: Requirements 3.3
 */
describe('RegionsTypeOrmRepository', () => {
  let repository: RegionsTypeOrmRepository;
  let mockTypeOrmRepo: ReturnType<typeof createMockTypeOrmRepository> & { findOneOrFail: jest.Mock };
  let mockQueryService: ReturnType<typeof createMockQueryService>;

  // Note: RegionEntity uses string ID in the repository (passed as-is to TypeORM)
  // The mapEntity function returns e.id directly without conversion
  const mockRegionEntity: RegionEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'southwest',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
    states: [],
  } as unknown as RegionEntity;

  const expectedDomainRegion: Region = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'southwest',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    mockTypeOrmRepo = createMockTypeOrmRepository() as any;
    // Add findOneOrFail mock since it's used in update()
    mockTypeOrmRepo.findOneOrFail = jest.fn();
    mockQueryService = createMockQueryService();

    repository = new RegionsTypeOrmRepository(
      mockTypeOrmRepo as any,
      mockQueryService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 3.3
     */
    it('should return mapped domain region when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockRegionEntity);

      const result = await repository.findById(mockRegionEntity.id);

      expect(result).toEqual(expectedDomainRegion);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockRegionEntity.id },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when region not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    /**
     * Test ID is passed as-is to query
     */
    it('should pass ID as-is to query', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockRegionEntity);

      await repository.findById('test-uuid-42');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'test-uuid-42' },
      });
    });
  });

  describe('findByNormalizedName', () => {
    /**
     * Test successful retrieval by normalized name
     * Validates: Requirements 3.3
     */
    it('should return mapped domain region when found by name', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockRegionEntity);

      const result = await repository.findByNormalizedName('southwest');

      expect(result).toEqual(expectedDomainRegion);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'southwest' },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when region not found by name', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByNormalizedName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 3.3
     */
    it('should return paginated results with mapped domain regions', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockRegionEntity], 1]);

      const result = await repository.findPage({ offset: 0, limit: 25 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainRegion);
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
        filter: 'name:eq:southwest',
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

      // Mock normalizeWithValidation to return empty sort
      mockQueryService.normalizeWithValidation.mockReturnValue({
        offset: 0,
        limit: 25,
        filter: { conditions: [], logicalOperator: 'AND' },
        sort: { conditions: [] },
        search: { query: '', fields: [] },
      });

      await repository.findPage({ offset: 0, limit: 25 });

      expect(mockQb.orderBy).toHaveBeenCalledWith('region.name', 'ASC');
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
     * Test region creation
     * Validates: Requirements 3.3
     */
    it('should create and return mapped domain region', async () => {
      const createData = { name: 'northeast' };

      const savedEntity = {
        ...mockRegionEntity,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'northeast',
      };

      mockTypeOrmRepo.create.mockReturnValue(savedEntity);
      mockTypeOrmRepo.save.mockResolvedValue(savedEntity);

      const result = await repository.create(createData as any);

      expect(result.name).toBe('northeast');
      expect(result.id).toBe('660e8400-e29b-41d4-a716-446655440001');
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(createData);
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    /**
     * Test region update
     * Validates: Requirements 3.3
     */
    it('should update and return mapped domain region', async () => {
      const updateData = { name: 'southwest updated' };
      const updatedEntity = {
        ...mockRegionEntity,
        name: 'southwest updated',
      };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOneOrFail.mockResolvedValue(updatedEntity);

      const result = await repository.update(mockRegionEntity.id, updateData);

      expect(result.name).toBe('southwest updated');
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: mockRegionEntity.id },
        updateData,
      );
    });

    /**
     * Test update with findOneOrFail behavior
     */
    it('should throw error when entity not found after update', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      // Simulate findOneOrFail throwing
      mockTypeOrmRepo.findOneOrFail.mockRejectedValue(new Error('Entity not found'));

      await expect(
        repository.update('non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    /**
     * Test region deletion
     * Validates: Requirements 3.3
     */
    it('should delete region by id', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete(mockRegionEntity.id);

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith({ id: mockRegionEntity.id });
    });
  });

  describe('mapEntity (via findById)', () => {
    /**
     * Test entity to domain mapping
     * Validates: Requirements 3.3
     */
    it('should correctly map all entity fields to domain model', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockRegionEntity);

      const result = await repository.findById(mockRegionEntity.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockRegionEntity.id);
      expect(result!.name).toBe(mockRegionEntity.name);
      expect(result!.created).toEqual(mockRegionEntity.created);
      expect(result!.lastModified).toEqual(mockRegionEntity.lastModified);
      expect(result!.modifiedBy).toBe(mockRegionEntity.modifiedBy);
    });

    /**
     * Test ID is preserved as-is in domain model
     */
    it('should preserve ID as-is in domain model', async () => {
      const entityWithUuid = { ...mockRegionEntity, id: 'test-uuid-123' };
      mockTypeOrmRepo.findOne.mockResolvedValue(entityWithUuid);

      const result = await repository.findById('test-uuid-123');

      expect(result!.id).toBe('test-uuid-123');
    });
  });
});
