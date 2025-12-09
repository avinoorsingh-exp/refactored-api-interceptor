import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CountriesRepository } from './countries.repository.js';
import { CountryEntity } from '@exprealty/database';
import type { Country } from '@exprealty/shared-domain';
import {
  createMockTypeOrmRepository,
  createMockQueryService,
} from '../../../../../test/utils/mock-factories.js';

/**
 * Unit tests for CountriesRepository
 * Tests all CRUD operations including upsert functionality
 * Validates: Requirements 3.5
 */
describe('CountriesRepository', () => {
  let repository: CountriesRepository;
  let mockTypeOrmRepo: ReturnType<typeof createMockTypeOrmRepository>;
  let mockQueryService: ReturnType<typeof createMockQueryService>;

  const mockCountryEntity: CountryEntity = {
    id: 1,
    name: 'United States',
    alpha2: 'US',
    alpha3: 'USA',
    number: 840,
    dialingCode: 1,
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  } as CountryEntity;

  const expectedDomainCountry: Country = {
    id: 1,
    name: 'United States',
    alpha2: 'US',
    alpha3: 'USA',
    number: 840,
    dialingCode: 1,
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    mockTypeOrmRepo = createMockTypeOrmRepository();
    mockQueryService = createMockQueryService();

    repository = new CountriesRepository(
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
     * Validates: Requirements 3.5
     */
    it('should return mapped domain country when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockCountryEntity);

      const result = await repository.findById(1);

      expect(result).toEqual(expectedDomainCountry);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when country not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByCode', () => {
    /**
     * Test successful retrieval by alpha-2 code
     * Validates: Requirements 3.5
     */
    it('should return mapped domain country when found by code', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockCountryEntity);

      const result = await repository.findByCode('US');

      expect(result).toEqual(expectedDomainCountry);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { alpha2: 'US' },
      });
    });

    /**
     * Test not found scenario
     */
    it('should return null when country not found by code', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByCode('XX');

      expect(result).toBeNull();
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 3.5
     */
    it('should return paginated results with mapped domain countries', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockCountryEntity], 1]);

      const result = await repository.findPage({ offset: 0, limit: 25 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(expectedDomainCountry);
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
        filter: 'dialingCode:eq:1',
        sort: 'name:ASC',
      });

      expect(mockQueryService.normalizeWithValidation).toHaveBeenCalled();
      expect(mockQueryService.applyAllWithStrategies).toHaveBeenCalled();
    });

    /**
     * Test default sorting by name ASC
     */
    it('should apply default sort by name ASC when no sort specified', async () => {
      const mockQb = mockTypeOrmRepo.createQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findPage({ offset: 0, limit: 25 });

      expect(mockQb.orderBy).toHaveBeenCalledWith('country.name', 'ASC');
    });
  });

  describe('create', () => {
    /**
     * Test country creation
     * Validates: Requirements 3.5
     */
    it('should create and return mapped domain country', async () => {
      const createData = {
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
        dialingCode: 1,
      };

      const savedEntity = {
        ...mockCountryEntity,
        id: 2,
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
      };

      mockTypeOrmRepo.create.mockReturnValue(savedEntity);
      mockTypeOrmRepo.save.mockResolvedValue(savedEntity);

      const result = await repository.create(createData);

      expect(result.name).toBe('Canada');
      expect(result.alpha2).toBe('CA');
      expect(result.alpha3).toBe('CAN');
      expect(result.number).toBe(124);
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(createData);
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    /**
     * Test duplicate alpha2 code handling
     * Validates: Requirements 3.5
     */
    it('should throw ConflictException for duplicate alpha2 code', async () => {
      const createData = {
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
        dialingCode: 1,
      };

      const queryError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (queryError as any).code = '23505';
      (queryError as any).detail = 'Key (alpha_2)=(CA) already exists.';

      mockTypeOrmRepo.create.mockReturnValue(createData);
      mockTypeOrmRepo.save.mockRejectedValue(queryError);

      await expect(repository.create(createData)).rejects.toThrow(ConflictException);
      await expect(repository.create(createData)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('alpha-2'),
          i18nType: 'agent.country.duplicate_code',
        },
      });
    });

    /**
     * Test duplicate alpha3 code handling
     */
    it('should throw ConflictException for duplicate alpha3 code', async () => {
      const createData = {
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
        dialingCode: 1,
      };

      const queryError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (queryError as any).code = '23505';
      (queryError as any).detail = 'Key (alpha_3)=(CAN) already exists.';

      mockTypeOrmRepo.create.mockReturnValue(createData);
      mockTypeOrmRepo.save.mockRejectedValue(queryError);

      await expect(repository.create(createData)).rejects.toThrow(ConflictException);
      await expect(repository.create(createData)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('alpha-3'),
        },
      });
    });

    /**
     * Test duplicate number handling
     */
    it('should throw ConflictException for duplicate number', async () => {
      const createData = {
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
        dialingCode: 1,
      };

      const queryError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (queryError as any).code = '23505';
      (queryError as any).detail = 'Key (number)=(124) already exists.';

      mockTypeOrmRepo.create.mockReturnValue(createData);
      mockTypeOrmRepo.save.mockRejectedValue(queryError);

      await expect(repository.create(createData)).rejects.toThrow(ConflictException);
      await expect(repository.create(createData)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('number'),
        },
      });
    });

    /**
     * Test non-unique constraint errors are re-thrown
     */
    it('should re-throw non-unique constraint errors', async () => {
      const createData = {
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
        dialingCode: 1,
      };

      const queryError = new QueryFailedError('INSERT', [], new Error('connection error'));
      (queryError as any).code = '08001'; // Connection error code

      mockTypeOrmRepo.create.mockReturnValue(createData);
      mockTypeOrmRepo.save.mockRejectedValue(queryError);

      await expect(repository.create(createData)).rejects.toThrow(QueryFailedError);
    });
  });

  describe('update', () => {
    /**
     * Test country update
     * Validates: Requirements 3.5
     */
    it('should update and return mapped domain country', async () => {
      const updateData = { name: 'United States of America' };
      const updatedEntity = {
        ...mockCountryEntity,
        name: 'United States of America',
      };

      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOneOrFail = jest.fn().mockResolvedValue(updatedEntity);

      const result = await repository.update(1, updateData);

      expect(result.name).toBe('United States of America');
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith({ id: 1 }, updateData);
    });
  });

  describe('delete', () => {
    /**
     * Test country deletion
     * Validates: Requirements 3.5
     */
    it('should delete country by id', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete(1);

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('upsert', () => {
    /**
     * Test upsert creates new country
     * Validates: Requirements 3.5
     */
    it('should create new country when it does not exist', async () => {
      const upsertData = {
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
        dialingCode: 1,
      };

      const newEntity = {
        ...mockCountryEntity,
        id: 2,
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
      };

      // First findOne returns null (country doesn't exist)
      mockTypeOrmRepo.findOne.mockResolvedValueOnce(null);
      // upsert succeeds
      mockTypeOrmRepo.upsert = jest.fn().mockResolvedValue({ identifiers: [{ id: 2 }] });
      // findOneOrFail returns the new entity
      mockTypeOrmRepo.findOneOrFail = jest.fn().mockResolvedValue(newEntity);

      const result = await repository.upsert(upsertData);

      expect(result.country.alpha2).toBe('CA');
      expect(result.created).toBe(true);
    });

    /**
     * Test upsert updates existing country
     * Validates: Requirements 3.5
     */
    it('should update existing country when it exists', async () => {
      const upsertData = {
        name: 'United States Updated',
        alpha2: 'US',
        alpha3: 'USA',
        number: 840,
        dialingCode: 1,
      };

      const updatedEntity = {
        ...mockCountryEntity,
        name: 'United States Updated',
      };

      // First findOne returns existing country
      mockTypeOrmRepo.findOne.mockResolvedValueOnce(mockCountryEntity);
      // upsert succeeds
      mockTypeOrmRepo.upsert = jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] });
      // findOneOrFail returns the updated entity
      mockTypeOrmRepo.findOneOrFail = jest.fn().mockResolvedValue(updatedEntity);

      const result = await repository.upsert(upsertData);

      expect(result.country.name).toBe('United States Updated');
      expect(result.created).toBe(false);
    });
  });

  describe('mapEntity (via findById)', () => {
    /**
     * Test entity to domain mapping
     * Validates: Requirements 3.5
     */
    it('should correctly map all entity fields to domain model', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockCountryEntity);

      const result = await repository.findById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockCountryEntity.id);
      expect(result!.name).toBe(mockCountryEntity.name);
      expect(result!.alpha2).toBe(mockCountryEntity.alpha2);
      expect(result!.alpha3).toBe(mockCountryEntity.alpha3);
      expect(result!.number).toBe(mockCountryEntity.number);
      expect(result!.dialingCode).toBe(mockCountryEntity.dialingCode);
      expect(result!.created).toEqual(mockCountryEntity.created);
      expect(result!.lastModified).toEqual(mockCountryEntity.lastModified);
      expect(result!.modifiedBy).toBe(mockCountryEntity.modifiedBy);
    });
  });
});
