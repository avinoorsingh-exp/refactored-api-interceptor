import { StatesTypeOrmRepository } from './states.repository.js';
import { StateEntity } from '@exprealty/database';
import type { State } from '@exprealty/shared-domain';
import {
  createMockTypeOrmRepository,
  createMockQueryService,
  createMockProjectionService,
} from '../../../../../test/utils/mock-factories.js';

/**
 * Unit tests for StatesTypeOrmRepository
 * Tests findById(), findByCode(), findByRegionId(), findPage(), create(), update(), mapToDomain(), mapToEntity()
 * Validates: Requirements 3.1, 3.6
 */
describe('StatesTypeOrmRepository', () => {
  let repository: StatesTypeOrmRepository;
  let mockTypeOrmRepo: ReturnType<typeof createMockTypeOrmRepository>;
  let mockQueryService: ReturnType<typeof createMockQueryService>;
  let mockProjectionService: ReturnType<typeof createMockProjectionService>;
  let mockLogger: any;

  const mockStateEntity: StateEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Texas',
    code: 'TX',
    isActive: true,
    regionId: BigInt(1),
    countryId: 1,
    email: 'texas@example.com',
    signatureDistributionEmail: 'sig-texas@example.com',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
    region: { id: 1, name: 'Southwest' },
    country: { id: 1, name: 'United States', alpha2: 'US', alpha3: 'USA' },
    statePrograms: [],
  } as unknown as StateEntity;

  const expectedDomainState: State = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Texas',
    code: 'TX',
    isActive: true,
    regionId: '1',
    countryId: 1,
    email: 'texas@example.com',
    signatureDistributionEmail: 'sig-texas@example.com',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
    region: { id: 1, name: 'Southwest' },
    country: { id: 1, name: 'United States', alpha2: 'US', alpha3: 'USA' },
    statePrograms: [],
  };

  beforeEach(() => {
    mockTypeOrmRepo = createMockTypeOrmRepository();
    mockQueryService = createMockQueryService();
    mockProjectionService = createMockProjectionService();
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    repository = new StatesTypeOrmRepository(
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
     * Validates: Requirements 3.1
     */
    it('should return mapped domain state when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockStateEntity);

      const result = await repository.findById(mockStateEntity.id);

      expect(result).toEqual(expectedDomainState);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockStateEntity.id },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when state not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByCode', () => {
    /**
     * Test successful retrieval by code
     * Validates: Requirements 3.1
     */
    it('should return mapped domain state when found by code', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockStateEntity);

      const result = await repository.findByCode('TX');

      expect(result).toEqual(expectedDomainState);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { code: 'TX' },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when state not found by code', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByCode('XX');

      expect(result).toBeNull();
    });
  });

  describe('findByRegionId', () => {
    /**
     * Test retrieval by region ID
     * Validates: Requirements 3.1
     */
    it('should return array of mapped domain states for region', async () => {
      const mockEntities = [
        mockStateEntity,
        { ...mockStateEntity, id: 'another-id', code: 'NM', name: 'New Mexico' },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(mockEntities);

      const result = await repository.findByRegionId('1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expectedDomainState);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { regionId: BigInt(1) },
      });
    });

    /**
     * Test empty result
     */
    it('should return empty array when no states in region', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      const result = await repository.findByRegionId('999');

      expect(result).toEqual([]);
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 3.1
     */
    it('should return paginated results with mapped domain states', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockStateEntity], 1]);

      const result = await repository.findPage({ offset: 0, limit: 25 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainState);
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
        filter: 'isActive:eq:true',
        sort: 'name:ASC',
      });

      expect(mockQueryService.normalizeWithValidation).toHaveBeenCalled();
      expect(mockQueryService.applyAllWithStrategies).toHaveBeenCalled();
    });
  });


  describe('create', () => {
    /**
     * Test state creation
     * Validates: Requirements 3.1
     */
    it('should create and return mapped domain state', async () => {
      const createData = {
        name: 'California',
        code: 'CA',
        isActive: true,
        regionId: '2',
        countryId: 1,
        email: 'california@example.com',
      };

      const savedEntity = {
        ...mockStateEntity,
        id: 'new-id',
        name: 'California',
        code: 'CA',
        regionId: BigInt(2),
        email: 'california@example.com',
      };

      mockTypeOrmRepo.create.mockReturnValue(savedEntity);
      mockTypeOrmRepo.save.mockResolvedValue(savedEntity);

      const result = await repository.create(createData as any);

      expect(result.name).toBe('California');
      expect(result.code).toBe('CA');
      expect(result.regionId).toBe('2');
      expect(mockTypeOrmRepo.create).toHaveBeenCalled();
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    /**
     * Test state update
     * Validates: Requirements 3.1
     */
    it('should update and return mapped domain state', async () => {
      const updateData = { name: 'Texas Updated', isActive: false };
      const updatedEntity = {
        ...mockStateEntity,
        name: 'Texas Updated',
        isActive: false,
      };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(updatedEntity);

      const result = await repository.update(mockStateEntity.id, updateData);

      expect(result.name).toBe('Texas Updated');
      expect(result.isActive).toBe(false);
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: mockStateEntity.id },
        expect.objectContaining({ name: 'Texas Updated', isActive: false }),
      );
    });

    /**
     * Test update not found error
     */
    it('should throw error when entity not found after update', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(
        repository.update(mockStateEntity.id, { name: 'Updated' }),
      ).rejects.toThrow('Entity with id');
    });
  });

  describe('mapToDomain (via findById)', () => {
    /**
     * Test entity to domain mapping
     * Validates: Requirements 3.6
     */
    it('should correctly map all entity fields to domain model', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockStateEntity);

      const result = await repository.findById(mockStateEntity.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockStateEntity.id);
      expect(result!.name).toBe(mockStateEntity.name);
      expect(result!.code).toBe(mockStateEntity.code);
      expect(result!.isActive).toBe(mockStateEntity.isActive);
      expect(result!.regionId).toBe(String(mockStateEntity.regionId));
      expect(result!.countryId).toBe(mockStateEntity.countryId);
      expect(result!.email).toBe(mockStateEntity.email);
      expect(result!.signatureDistributionEmail).toBe(mockStateEntity.signatureDistributionEmail);
      expect(result!.modifiedBy).toBe(mockStateEntity.modifiedBy);
    });

    /**
     * Test mapping with related entities
     */
    it('should map related region and country when present', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockStateEntity);

      const result = await repository.findById(mockStateEntity.id);

      expect(result!.region).toEqual({ id: 1, name: 'Southwest' });
      expect(result!.country).toEqual({
        id: 1,
        name: 'United States',
        alpha2: 'US',
        alpha3: 'USA',
      });
    });

    /**
     * Test mapping without related entities
     */
    it('should handle missing related entities', async () => {
      const entityWithoutRelations = {
        ...mockStateEntity,
        region: undefined,
        country: undefined,
      };
      mockTypeOrmRepo.findOne.mockResolvedValue(entityWithoutRelations);

      const result = await repository.findById(mockStateEntity.id);

      expect(result!.region).toBeUndefined();
      expect(result!.country).toBeUndefined();
    });
  });

  describe('mapToEntity (via create/update)', () => {
    /**
     * Test domain to entity mapping
     * Validates: Requirements 3.6
     */
    it('should correctly map domain fields to entity for creation', async () => {
      const createData = {
        name: 'New State',
        code: 'NS',
        isActive: true,
        regionId: '5',
        countryId: 2,
        email: 'new@example.com',
        signatureDistributionEmail: 'sig-new@example.com',
        modifiedBy: 'admin',
      };

      mockTypeOrmRepo.create.mockReturnValue({ ...mockStateEntity, ...createData, regionId: BigInt(5) });
      mockTypeOrmRepo.save.mockResolvedValue({ ...mockStateEntity, ...createData, regionId: BigInt(5) });

      await repository.create(createData as any);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New State',
          code: 'NS',
          isActive: true,
          regionId: BigInt(5),
          countryId: 2,
          email: 'new@example.com',
          signatureDistributionEmail: 'sig-new@example.com',
          modifiedBy: 'admin',
        }),
      );
    });

    /**
     * Test partial update mapping
     */
    it('should only map provided fields for partial update', async () => {
      const updateData = { name: 'Updated Name' };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue({ ...mockStateEntity, name: 'Updated Name' });

      await repository.update(mockStateEntity.id, updateData);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: mockStateEntity.id },
        { name: 'Updated Name' },
      );
    });

    /**
     * Test countryId mapping
     */
    it('should map countryId when provided', async () => {
      const updateData = { countryId: 2 };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue({ ...mockStateEntity, countryId: 2 });

      await repository.update(mockStateEntity.id, updateData);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: mockStateEntity.id },
        { countryId: 2 },
      );
    });
  });

  describe('delete', () => {
    /**
     * Test state deletion (inherited from base)
     * Validates: Requirements 3.1
     */
    it('should delete state by id', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete(mockStateEntity.id);

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith({
        id: mockStateEntity.id,
      });
    });
  });

  describe('findAll', () => {
    /**
     * Test findAll (inherited from base)
     * Validates: Requirements 3.1
     */
    it('should return all states with pagination', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockStateEntity], 1]);

      const result = await repository.findAll({ offset: 0, limit: 25 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainState);
      expect(result.total).toBe(1);
    });
  });

  describe('findPage with field selection', () => {
    /**
     * Test findPage with field selection
     * Validates: Requirements 3.1
     */
    it('should apply projection when field selection is provided', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockStateEntity], 1]);

      const selection = { fields: ['id', 'name', 'code'], include: ['region'] };
      await repository.findPage({ offset: 0, limit: 25 }, selection);

      expect(mockProjectionService.applyProjection).toHaveBeenCalled();
      expect(mockProjectionService.applyRelations).toHaveBeenCalled();
    });
  });
});
