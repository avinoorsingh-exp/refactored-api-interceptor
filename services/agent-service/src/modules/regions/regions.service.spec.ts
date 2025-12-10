import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegionsService } from './regions.service.js'
import type { IRegionsRepository } from './ports/regions.repository.port.js';
import type { Region, CreateRegionInput, UpdateRegionInput } from '@exprealty/shared-domain';

/**
 * Unit tests for RegionsService
 * Tests create(), findById(), update(), findPage() with mocked repository
 * Validates: Requirements 2.3, 2.6, 2.7
 */
describe('RegionsService', () => {
  let service: RegionsService;
  let repository: jest.Mocked<IRegionsRepository>;

  const mockRegion: Region = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'southwest',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByNormalizedName: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    } as jest.Mocked<IRegionsRepository>;

    service = new RegionsService(repository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateRegionInput = { name: 'Northeast' };

    /**
     * Test successful region creation
     * Validates: Requirements 2.3
     */
    it('should create a new region when name does not exist', async () => {
      const newRegion: Region = {
        ...mockRegion,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'northeast',
      };

      repository.findByNormalizedName.mockResolvedValue(null);
      repository.create.mockResolvedValue(newRegion);

      const result = await service.create(createDto);

      expect(result).toEqual(newRegion);
      expect(repository.findByNormalizedName).toHaveBeenCalledWith('northeast');
      expect(repository.create).toHaveBeenCalledWith({ name: 'northeast' });
    });

    /**
     * Test duplicate name detection
     * Validates: Requirements 2.6
     */
    it('should throw ConflictException when region name already exists', async () => {
      repository.findByNormalizedName.mockResolvedValue(mockRegion);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('Northeast'),
          i18nType: 'agent.region.duplicate_name',
        },
      });

      expect(repository.findByNormalizedName).toHaveBeenCalledWith('northeast');
      expect(repository.create).not.toHaveBeenCalled();
    });

    /**
     * Test error propagation from repository
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database connection failed');
      repository.findByNormalizedName.mockResolvedValue(null);
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(error);
    });

    /**
     * Test name normalization (lowercase, trim)
     */
    it('should normalize name to lowercase and trim whitespace', async () => {
      const createDtoWithSpaces: CreateRegionInput = { name: '  NORTHEAST  ' };
      const newRegion: Region = {
        ...mockRegion,
        name: 'northeast',
      };

      repository.findByNormalizedName.mockResolvedValue(null);
      repository.create.mockResolvedValue(newRegion);

      await service.create(createDtoWithSpaces);

      expect(repository.findByNormalizedName).toHaveBeenCalledWith('northeast');
      expect(repository.create).toHaveBeenCalledWith({ name: 'northeast' });
    });
  });

  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 2.3
     */
    it('should return region when found by ID', async () => {
      repository.findById.mockResolvedValue(mockRegion);

      const result = await service.findById(mockRegion.id);

      expect(result).toEqual(mockRegion);
      expect(repository.findById).toHaveBeenCalledWith(mockRegion.id);
    });

    /**
     * Test not found scenario
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when region not found by ID', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent-id'),
          i18nType: 'agent.region.not_found',
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

      await expect(service.findById(mockRegion.id)).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    const updateDto: UpdateRegionInput = { name: 'Southwest Updated' };

    /**
     * Test successful update
     * Validates: Requirements 2.3
     */
    it('should update region when it exists', async () => {
      const updatedRegion: Region = {
        ...mockRegion,
        name: 'southwest updated',
      };

      repository.findById.mockResolvedValue(mockRegion);
      repository.findByNormalizedName.mockResolvedValue(null);
      repository.update.mockResolvedValue(updatedRegion);

      const result = await service.update(mockRegion.id, updateDto);

      expect(result).toEqual(updatedRegion);
      expect(repository.findById).toHaveBeenCalledWith(mockRegion.id);
      expect(repository.update).toHaveBeenCalledWith(mockRegion.id, { name: 'southwest updated' });
    });

    /**
     * Test not found on update
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when updating non-existent region', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateDto)).rejects.toMatchObject({
        response: {
          i18nType: 'agent.region.not_found',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate name detection on update
     * Validates: Requirements 2.6
     */
    it('should throw ConflictException when updating to existing name', async () => {
      const updateWithName: UpdateRegionInput = { name: 'Northeast' };
      const existingNortheast: Region = {
        ...mockRegion,
        id: 'different-id',
        name: 'northeast',
      };

      repository.findById.mockResolvedValue(mockRegion);
      repository.findByNormalizedName.mockResolvedValue(existingNortheast);

      await expect(service.update(mockRegion.id, updateWithName)).rejects.toThrow(ConflictException);
      await expect(service.update(mockRegion.id, updateWithName)).rejects.toMatchObject({
        response: {
          i18nType: 'agent.region.duplicate_name',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test updating to same name (should be allowed)
     */
    it('should allow updating to the same name', async () => {
      const updateWithSameName: UpdateRegionInput = { name: 'Southwest' };
      const updatedRegion: Region = { ...mockRegion, name: 'southwest' };

      repository.findById.mockResolvedValue(mockRegion);
      repository.findByNormalizedName.mockResolvedValue(mockRegion); // Same region
      repository.update.mockResolvedValue(updatedRegion);

      const result = await service.update(mockRegion.id, updateWithSameName);

      expect(result).toEqual(updatedRegion);
      expect(repository.update).toHaveBeenCalled();
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database error');
      repository.findById.mockResolvedValue(mockRegion);
      repository.findByNormalizedName.mockResolvedValue(null);
      repository.update.mockRejectedValue(error);

      await expect(service.update(mockRegion.id, updateDto)).rejects.toThrow(error);
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 2.3
     */
    it('should return paginated regions from repository', async () => {
      const mockRegions = [
        { ...mockRegion, name: 'northeast' },
        { ...mockRegion, id: 'another-id', name: 'southwest' },
      ];

      repository.findPage.mockResolvedValue({
        items: mockRegions,
        total: 50,
      });

      const result = await service.findPage({ offset: 0, limit: 25 });

      expect(result.regions).toEqual(mockRegions);
      expect(result.total).toBe(50);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 });
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockRegion],
        total: 50,
      });

      const result = await service.findPage({ offset: 25, limit: 25 });

      expect(result.regions).toHaveLength(1);
      expect(result.total).toBe(50);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 25, limit: 25 });
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

      expect(result.regions).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test with filter, sort, and search
     */
    it('should pass filter, sort, and search to repository', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockRegion],
        total: 1,
      });

      const query = {
        offset: 0,
        limit: 25,
        filter: 'name:eq:southwest',
        sort: 'name:ASC',
        search: 'south',
      };

      await service.findPage(query);

      expect(repository.findPage).toHaveBeenCalledWith(query);
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
