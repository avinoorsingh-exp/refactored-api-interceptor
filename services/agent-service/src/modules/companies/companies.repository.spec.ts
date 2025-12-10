import { CompaniesTypeOrmRepository } from './companies.repository.js';
import { CompanyEntity } from '@exprealty/database';
import type { Company } from '@exprealty/shared-domain';
import { createMockTypeOrmRepository } from '../../../../../test/utils/mock-factories.js';

/**
 * Unit tests for CompaniesTypeOrmRepository
 * Tests all CRUD operations and query building
 * Validates: Requirements 3.2
 */
describe('CompaniesTypeOrmRepository', () => {
  let repository: CompaniesTypeOrmRepository;
  let mockTypeOrmRepo: ReturnType<typeof createMockTypeOrmRepository>;

  const mockCompanyEntity: CompanyEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'acme corporation',
    email: 'contact@acme.com',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
    externalReferences: [],
  } as unknown as CompanyEntity;

  const expectedDomainCompany: Company = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'acme corporation',
    email: 'contact@acme.com',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    mockTypeOrmRepo = createMockTypeOrmRepository();
    repository = new CompaniesTypeOrmRepository(mockTypeOrmRepo as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 3.2
     */
    it('should return mapped domain company when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockCompanyEntity);

      const result = await repository.findById(mockCompanyEntity.id);

      expect(result).toEqual(expectedDomainCompany);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockCompanyEntity.id },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when company not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 3.2
     */
    it('should return paginated results with mapped domain companies', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockCompanyEntity], 1]);

      const result = await repository.findPage({ offset: 0, limit: 25 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainCompany);
      expect(result.total).toBe(1);
    });

    /**
     * Test pagination with offset
     */
    it('should apply pagination offset and limit', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findPage({ offset: 10, limit: 50 });

      expect(mockQb.skip).toHaveBeenCalledWith(10);
      expect(mockQb.take).toHaveBeenCalledWith(50);
    });

    /**
     * Test default ordering
     */
    it('should order by created ASC and id ASC', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findPage({ offset: 0, limit: 25 });

      expect(mockQb.orderBy).toHaveBeenCalledWith('w.created', 'ASC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('w.id', 'ASC');
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
  });

  describe('searchByNameFragment', () => {
    /**
     * Test search by name fragment
     * Validates: Requirements 3.2
     */
    it('should search companies by name fragment using ILIKE', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockCompanyEntity], 1]);

      const result = await repository.searchByNameFragment(
        { offset: 0, limit: 25 },
        'acme',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainCompany);
      expect(mockQb.where).toHaveBeenCalledWith('w.name ILIKE :q', { q: '%acme%' });
    });

    /**
     * Test search with pagination
     */
    it('should apply pagination to search results', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.searchByNameFragment({ offset: 10, limit: 50 }, 'test');

      expect(mockQb.skip).toHaveBeenCalledWith(10);
      expect(mockQb.take).toHaveBeenCalledWith(50);
    });

    /**
     * Test empty search results
     */
    it('should handle empty search results', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await repository.searchByNameFragment(
        { offset: 0, limit: 25 },
        'nonexistent',
      );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('create', () => {
    /**
     * Test company creation
     * Validates: Requirements 3.2
     */
    it('should create and return mapped domain company', async () => {
      const createData = {
        name: 'new company',
        email: 'new@company.com',
        created: new Date(),
        lastModified: new Date(),
        modifiedBy: 'system',
      };

      const savedEntity = {
        ...mockCompanyEntity,
        id: 'new-id',
        name: 'new company',
        email: 'new@company.com',
      };

      mockTypeOrmRepo.create.mockReturnValue(savedEntity);
      mockTypeOrmRepo.save.mockResolvedValue(savedEntity);

      const result = await repository.create(createData);

      expect(result.name).toBe('new company');
      expect(result.email).toBe('new@company.com');
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(createData);
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    /**
     * Test company update
     * Validates: Requirements 3.2
     */
    it('should update and return mapped domain company', async () => {
      const updateData = { name: 'updated company', email: 'updated@company.com' };
      const updatedEntity = {
        ...mockCompanyEntity,
        name: 'updated company',
        email: 'updated@company.com',
      };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(updatedEntity);

      // Note: The repository uses findOneOrFail internally, but our mock uses findOne
      // We need to mock the behavior correctly
      const mockFindOneOrFail = jest.fn().mockResolvedValue(updatedEntity);
      (mockTypeOrmRepo as any).findOneOrFail = mockFindOneOrFail;

      const result = await repository.update(mockCompanyEntity.id, updateData);

      expect(result.name).toBe('updated company');
      expect(result.email).toBe('updated@company.com');
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: mockCompanyEntity.id },
        updateData,
      );
    });

    /**
     * Test partial update
     */
    it('should handle partial updates', async () => {
      const updateData = { name: 'only name updated' };
      const updatedEntity = {
        ...mockCompanyEntity,
        name: 'only name updated',
      };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      (mockTypeOrmRepo as any).findOneOrFail = jest.fn().mockResolvedValue(updatedEntity);

      const result = await repository.update(mockCompanyEntity.id, updateData);

      expect(result.name).toBe('only name updated');
      expect(result.email).toBe(mockCompanyEntity.email);
    });
  });

  describe('delete', () => {
    /**
     * Test company deletion
     * Validates: Requirements 3.2
     */
    it('should delete company by id', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete(mockCompanyEntity.id);

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith({
        id: mockCompanyEntity.id,
      });
    });
  });

  describe('mapEntity (via findById)', () => {
    /**
     * Test entity to domain mapping
     * Validates: Requirements 3.2
     */
    it('should correctly map all entity fields to domain model', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockCompanyEntity);

      const result = await repository.findById(mockCompanyEntity.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockCompanyEntity.id);
      expect(result!.name).toBe(mockCompanyEntity.name);
      expect(result!.email).toBe(mockCompanyEntity.email);
      expect(result!.created).toEqual(mockCompanyEntity.created);
      expect(result!.lastModified).toEqual(mockCompanyEntity.lastModified);
      expect(result!.modifiedBy).toBe(mockCompanyEntity.modifiedBy);
    });
  });
});
