import { ConflictException, NotFoundException } from '@nestjs/common';
import { MLSService } from './mls.service.js';
import type { IMLSRepository } from './ports/mls.repository.port.js';
import type { MLSType, CreateMLSInput, UpdateMLSInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for MLSService
 * Tests create(), findById(), findByName(), update(), findAll() with mocked repository
 */
describe('MLSService', () => {
  let service: MLSService;
  let repository: jest.Mocked<IMLSRepository>;
  let logger: jest.Mocked<LoggerService>;

  const mockMLS: MLSType = {
    id: '12345',
    name: 'Multiple Listing Service of Greater Metro',
    ouid: 'mls-org-123',
    globalId: 100,
    lifecycleStatus: 'active',
    shortName: 'Metro MLS',
    website: 'https://metromls.example.com',
    orgType: 'mls',
    kunversionUrl: 'https://kunversion.example.com/mls',
    addressId: '67890',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findByGlobalId: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IMLSRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    service = new MLSService(repository, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateMLSInput = {
      name: 'New MLS Service',
      lifecycleStatus: 'active',
      orgType: 'mls',
      ouid: 'new-mls-123',
      globalId: 200,
    };

    /**
     * Test successful MLS creation
     */
    it('should create a new MLS when name does not exist', async () => {
      const newMLS: MLSType = {
        ...mockMLS,
        id: '12346',
        name: 'New MLS Service',
        ouid: 'new-mls-123',
        globalId: 200,
      };

      repository.findByName.mockResolvedValue(null);
      repository.findByGlobalId.mockResolvedValue(null);
      repository.create.mockResolvedValue(newMLS);

      const result = await service.create(createDto);

      expect(result).toEqual(newMLS);
      expect(repository.findByName).toHaveBeenCalledWith('New MLS Service');
      expect(repository.findByGlobalId).toHaveBeenCalledWith(200);
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test duplicate name detection
     */
    it('should throw ConflictException when MLS name already exists', async () => {
      repository.findByName.mockResolvedValue(mockMLS);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('New MLS Service'),
          i18nType: 'agent.mls.duplicate_name',
        },
      });

      expect(repository.findByName).toHaveBeenCalledWith('New MLS Service');
      expect(repository.create).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate global_id detection
     */
    it('should throw ConflictException when global_id already exists', async () => {
      repository.findByName.mockResolvedValue(null);
      repository.findByGlobalId.mockResolvedValue(mockMLS);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('200'),
          i18nType: 'agent.mls.duplicate_global_id',
        },
      });

      expect(repository.findByGlobalId).toHaveBeenCalledWith(200);
      expect(repository.create).not.toHaveBeenCalled();
    });

    /**
     * Test error propagation from repository
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database connection failed');
      repository.findByName.mockResolvedValue(null);
      repository.findByGlobalId.mockResolvedValue(null);
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(error);
    });
  });

  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     */
    it('should return MLS when found by ID', async () => {
      repository.findById.mockResolvedValue(mockMLS);

      const result = await service.findById(mockMLS.id);

      expect(result).toEqual(mockMLS);
      expect(repository.findById).toHaveBeenCalledWith(mockMLS.id);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when MLS not found by ID', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent-id'),
          i18nType: 'agent.mls.not_found',
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

      await expect(service.findById(mockMLS.id)).rejects.toThrow(error);
    });
  });

  describe('findByName', () => {
    /**
     * Test successful retrieval by name
     */
    it('should return MLS when found by name', async () => {
      repository.findByName.mockResolvedValue(mockMLS);

      const result = await service.findByName(mockMLS.name);

      expect(result).toEqual(mockMLS);
      expect(repository.findByName).toHaveBeenCalledWith(mockMLS.name);
    });

    /**
     * Test not found scenario
     */
    it('should return null when MLS not found by name', async () => {
      repository.findByName.mockResolvedValue(null);

      const result = await service.findByName('non-existent');

      expect(result).toBeNull();
      expect(repository.findByName).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('findAll', () => {
    /**
     * Test paginated list retrieval
     */
    it('should return paginated MLS records with total count', async () => {
      const mockMLSList = [mockMLS, { ...mockMLS, id: '12346', name: 'MLS 2' }];
      repository.findPage.mockResolvedValue({ items: mockMLSList, total: 2 });

      const result = await service.findAll({ offset: 0, limit: 25 });

      expect(result).toEqual({ data: mockMLSList, total: 2 });
      expect(repository.findPage).toHaveBeenCalled();
    });

    /**
     * Test empty result
     */
    it('should return empty array when no MLS records found', async () => {
      repository.findPage.mockResolvedValue({ items: [], total: 0 });

      const result = await service.findAll({ offset: 0, limit: 25 });

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('update', () => {
    const updateDto: UpdateMLSInput = {
      name: 'Updated MLS Name',
      lifecycleStatus: 'archived',
    };

    /**
     * Test successful update
     */
    it('should update MLS successfully when it exists', async () => {
      const updatedMLS: MLSType = {
        ...mockMLS,
        name: 'Updated MLS Name',
        lifecycleStatus: 'archived',
      };

      repository.findById.mockResolvedValue(mockMLS);
      repository.findByName.mockResolvedValue(null);
      repository.update.mockResolvedValue(updatedMLS);

      const result = await service.update(mockMLS.id, updateDto);

      expect(result).toEqual(updatedMLS);
      expect(repository.findById).toHaveBeenCalledWith(mockMLS.id);
      expect(repository.findByName).toHaveBeenCalledWith('Updated MLS Name');
      expect(repository.update).toHaveBeenCalledWith(mockMLS.id, updateDto);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when MLS not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent', updateDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent'),
          i18nType: 'agent.mls.not_found',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate name conflict
     */
    it('should throw ConflictException when updating to an existing name', async () => {
      const existingMLS = { ...mockMLS, id: '99999', name: 'Updated MLS Name' };

      repository.findById.mockResolvedValue(mockMLS);
      repository.findByName.mockResolvedValue(existingMLS);

      await expect(service.update(mockMLS.id, updateDto)).rejects.toThrow(ConflictException);
      await expect(service.update(mockMLS.id, updateDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('Updated MLS Name'),
          i18nType: 'agent.mls.duplicate_name',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test update without changing name
     */
    it('should allow update when name is not changed', async () => {
      const updateDtoSameName: UpdateMLSInput = {
        lifecycleStatus: 'archived',
      };
      const updatedMLS: MLSType = {
        ...mockMLS,
        lifecycleStatus: 'archived',
      };

      repository.findById.mockResolvedValue(mockMLS);
      repository.update.mockResolvedValue(updatedMLS);

      const result = await service.update(mockMLS.id, updateDtoSameName);

      expect(result).toEqual(updatedMLS);
      expect(repository.findByName).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate global_id conflict during update
     */
    it('should throw ConflictException when updating to an existing global_id', async () => {
      const updateDtoWithGlobalId: UpdateMLSInput = {
        globalId: 999,
      };
      const existingMLS = { ...mockMLS, id: '99999', globalId: 999 };

      repository.findById.mockResolvedValue(mockMLS);
      repository.findByGlobalId.mockResolvedValue(existingMLS);

      await expect(service.update(mockMLS.id, updateDtoWithGlobalId)).rejects.toThrow(ConflictException);
      await expect(service.update(mockMLS.id, updateDtoWithGlobalId)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('999'),
          i18nType: 'agent.mls.duplicate_global_id',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
