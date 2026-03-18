import { ConflictException, NotFoundException } from '@nestjs/common';
import { OfficesService } from './offices.service.js';
import type { IOfficesRepository } from './ports/offices.repository.port.js';
import type { Office, CreateOfficeInput, UpdateOfficeInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for OfficesService
 * Tests create(), findById(), findByName(), update(), findAll() with mocked repository
 */
describe('OfficesService', () => {
  let service: OfficesService;
  let repository: jest.Mocked<IOfficesRepository>;
  let logger: jest.Mocked<LoggerService>;

  const mockOffice: Office = {
    id: '12345',
    name: 'Downtown Branch Office',
    website: 'https://downtown-office.example.com' as Office['website'],
    phone: '555-123-4567',
    lifecycleStatus: 'active',
    primaryState: 'California',
    companyId: '67890',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findByCompanyId: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IOfficesRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    service = new OfficesService(repository, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateOfficeInput = {
      name: 'New Branch Office',
      website: 'https://new-office.example.com' as Office['website'],
      phone: '555-987-6543',
      lifecycleStatus: 'new',
      primaryState: 'Texas',
      companyId: '67890',
    };

    /**
     * Test successful office creation
     */
    it('should create a new office when name does not exist', async () => {
      const newOffice: Office = {
        ...mockOffice,
        id: '12346',
        name: 'New Branch Office',
        website: 'https://new-office.example.com' as Office['website'],
        phone: '555-987-6543',
        lifecycleStatus: 'new',
        primaryState: 'Texas',
      };

      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(newOffice);

      const result = await service.create(createDto);

      expect(result).toEqual(newOffice);
      expect(repository.findByName).toHaveBeenCalledWith('New Branch Office');
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test duplicate name detection
     */
    it('should throw ConflictException when office name already exists', async () => {
      repository.findByName.mockResolvedValue(mockOffice);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('New Branch Office'),
          i18nType: 'agent.office.duplicate_name',
        },
      });

      expect(repository.findByName).toHaveBeenCalledWith('New Branch Office');
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
     */
    it('should return office when found by ID', async () => {
      repository.findById.mockResolvedValue(mockOffice);

      const result = await service.findById(mockOffice.id);

      expect(result).toEqual(mockOffice);
      expect(repository.findById).toHaveBeenCalledWith(mockOffice.id);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when office not found by ID', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent-id'),
          i18nType: 'agent.office.not_found',
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

      await expect(service.findById(mockOffice.id)).rejects.toThrow(error);
    });
  });

  describe('findByName', () => {
    /**
     * Test successful retrieval by name
     */
    it('should return office when found by name', async () => {
      repository.findByName.mockResolvedValue(mockOffice);

      const result = await service.findByName(mockOffice.name);

      expect(result).toEqual(mockOffice);
      expect(repository.findByName).toHaveBeenCalledWith(mockOffice.name);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when office not found by name', async () => {
      repository.findByName.mockResolvedValue(null);

      await expect(service.findByName('Non-existent Office')).rejects.toThrow(NotFoundException);
      await expect(service.findByName('Non-existent Office')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('Non-existent Office'),
          i18nType: 'agent.office.not_found',
        },
      });

      expect(repository.findByName).toHaveBeenCalledWith('Non-existent Office');
    });
  });

  describe('findByCompanyId', () => {
    /**
     * Test successful retrieval by company ID
     */
    it('should return offices when found by company ID', async () => {
      const offices = [mockOffice, { ...mockOffice, id: '12347', name: 'Second Office' }];
      repository.findByCompanyId.mockResolvedValue(offices);

      const result = await service.findByCompanyId('67890');

      expect(result).toEqual(offices);
      expect(repository.findByCompanyId).toHaveBeenCalledWith('67890');
    });

    /**
     * Test empty result
     */
    it('should return empty array when no offices found for company', async () => {
      repository.findByCompanyId.mockResolvedValue([]);

      const result = await service.findByCompanyId('99999');

      expect(result).toEqual([]);
      expect(repository.findByCompanyId).toHaveBeenCalledWith('99999');
    });
  });

  describe('findAll', () => {
    /**
     * Test successful pagination
     */
    it('should return paginated offices', async () => {
      const pageResult = {
        items: [mockOffice],
        total: 1,
      };
      repository.findPage.mockResolvedValue(pageResult);

      const queryParams = { offset: 0, limit: 25 };
      const result = await service.findAll(queryParams);

      expect(result).toEqual({ data: [mockOffice], total: 1 });
      expect(repository.findPage).toHaveBeenCalledWith(queryParams, undefined);
    });

    /**
     * Test pagination with field selection
     */
    it('should pass field selection to repository', async () => {
      const pageResult = {
        items: [mockOffice],
        total: 1,
      };
      repository.findPage.mockResolvedValue(pageResult);

      const queryParams = { offset: 0, limit: 25 };
      const selection = { fields: ['id', 'name'] };
      await service.findAll(queryParams, selection);

      expect(repository.findPage).toHaveBeenCalledWith(queryParams, selection);
    });
  });

  describe('update', () => {
    const updateDto: UpdateOfficeInput = {
      name: 'Updated Office Name',
      lifecycleStatus: 'pending_due_diligence',
    };

    /**
     * Test successful update
     */
    it('should update an office when it exists', async () => {
      const updatedOffice: Office = {
        ...mockOffice,
        name: 'Updated Office Name',
        lifecycleStatus: 'pending_due_diligence',
      };

      repository.findById.mockResolvedValue(mockOffice);
      repository.findByName.mockResolvedValue(null);
      repository.update.mockResolvedValue(updatedOffice);

      const result = await service.update(mockOffice.id, updateDto);

      expect(result).toEqual(updatedOffice);
      expect(repository.findById).toHaveBeenCalledWith(mockOffice.id);
      expect(repository.findByName).toHaveBeenCalledWith('Updated Office Name');
      expect(repository.update).toHaveBeenCalledWith(mockOffice.id, updateDto);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when office to update not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent-id'),
          i18nType: 'agent.office.not_found',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate name conflict on update
     */
    it('should throw ConflictException when updating name to existing name', async () => {
      const existingOffice: Office = {
        ...mockOffice,
        id: '12348',
        name: 'Updated Office Name',
      };

      repository.findById.mockResolvedValue(mockOffice);
      repository.findByName.mockResolvedValue(existingOffice);

      await expect(service.update(mockOffice.id, updateDto)).rejects.toThrow(ConflictException);
      await expect(service.update(mockOffice.id, updateDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('Updated Office Name'),
          i18nType: 'agent.office.duplicate_name',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test update without name change
     */
    it('should not check for duplicate when name is not changed', async () => {
      const updateWithoutName: UpdateOfficeInput = {
        lifecycleStatus: 'withdrawn',
      };

      const updatedOffice: Office = {
        ...mockOffice,
        lifecycleStatus: 'withdrawn',
      };

      repository.findById.mockResolvedValue(mockOffice);
      repository.update.mockResolvedValue(updatedOffice);

      const result = await service.update(mockOffice.id, updateWithoutName);

      expect(result).toEqual(updatedOffice);
      expect(repository.findByName).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(mockOffice.id, updateWithoutName);
    });
  });
});
