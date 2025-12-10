import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatesService } from './states.service.js';
import type { IStatesRepository } from './ports/states.repository.port.js';
import type { State, CreateStateInput, UpdateStateInput } from '@exprealty/shared-domain';

/**
 * Unit tests for StatesService
 * Tests create(), findById(), findByCode(), update(), findPage() with mocked repository
 * Validates: Requirements 2.1, 2.6, 2.7
 */
describe('StatesService', () => {
  let service: StatesService;
  let repository: jest.Mocked<IStatesRepository>;

  const mockState: State = {
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
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByRegionId: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IStatesRepository>;

    service = new StatesService(repository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateStateInput = {
      name: 'California',
      code: 'CA',
      isActive: true,
      regionId: '2',
      countryId: 1,
      email: 'california@example.com',
    };

    /**
     * Test successful state creation
     * Validates: Requirements 2.1
     */
    it('should create a new state when code does not exist', async () => {
      const newState: State = {
        ...mockState,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'California',
        code: 'CA',
        regionId: '2',
      };

      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(newState);

      const result = await service.create(createDto);

      expect(result).toEqual(newState);
      expect(repository.findByCode).toHaveBeenCalledWith('CA');
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test duplicate code detection
     * Validates: Requirements 2.6
     */
    it('should throw ConflictException when state code already exists', async () => {
      repository.findByCode.mockResolvedValue(mockState);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('CA'),
          i18nType: 'agent.state.duplicate_code',
        },
      });

      expect(repository.findByCode).toHaveBeenCalledWith('CA');
      expect(repository.create).not.toHaveBeenCalled();
    });

    /**
     * Test error propagation from repository
     */
    it('should propagate unexpected errors from repository', async () => {
      const error = new Error('Database connection failed');
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(error);
    });
  });


  describe('findById', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 2.1
     */
    it('should return state when found by ID', async () => {
      repository.findById.mockResolvedValue(mockState);

      const result = await service.findById(mockState.id);

      expect(result).toEqual(mockState);
      expect(repository.findById).toHaveBeenCalledWith(mockState.id);
    });

    /**
     * Test not found scenario
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when state not found by ID', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('non-existent-id'),
          i18nType: 'agent.state.not_found',
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

      await expect(service.findById(mockState.id)).rejects.toThrow(error);
    });
  });

  describe('findByCode', () => {
    /**
     * Test successful retrieval by code
     * Validates: Requirements 2.1
     */
    it('should return state when found by code', async () => {
      repository.findByCode.mockResolvedValue(mockState);

      const result = await service.findByCode('TX');

      expect(result).toEqual(mockState);
      expect(repository.findByCode).toHaveBeenCalledWith('TX');
    });

    /**
     * Test not found scenario
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when state not found by code', async () => {
      repository.findByCode.mockResolvedValue(null);

      await expect(service.findByCode('XX')).rejects.toThrow(NotFoundException);
      await expect(service.findByCode('XX')).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('XX'),
          i18nType: 'agent.state.not_found',
        },
      });

      expect(repository.findByCode).toHaveBeenCalledWith('XX');
    });
  });

  describe('update', () => {
    const updateDto: UpdateStateInput = {
      name: 'Texas Updated',
      isActive: false,
    };

    /**
     * Test successful update
     * Validates: Requirements 2.1
     */
    it('should update state when it exists', async () => {
      const updatedState: State = {
        ...mockState,
        name: 'Texas Updated',
        isActive: false,
      };

      repository.findById.mockResolvedValue(mockState);
      repository.update.mockResolvedValue(updatedState);

      const result = await service.update(mockState.id, updateDto);

      expect(result).toEqual(updatedState);
      expect(repository.findById).toHaveBeenCalledWith(mockState.id);
      expect(repository.update).toHaveBeenCalledWith(mockState.id, updateDto);
    });

    /**
     * Test not found on update
     * Validates: Requirements 2.7
     */
    it('should throw NotFoundException when updating non-existent state', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateDto)).rejects.toMatchObject({
        response: {
          i18nType: 'agent.state.not_found',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test duplicate code detection on update
     * Validates: Requirements 2.6
     */
    it('should throw ConflictException when updating to existing code', async () => {
      const updateWithCode: UpdateStateInput = { code: 'CA' };
      const existingCalifornia: State = {
        ...mockState,
        id: 'different-id',
        code: 'CA',
        name: 'California',
      };

      repository.findById.mockResolvedValue(mockState);
      repository.findByCode.mockResolvedValue(existingCalifornia);

      await expect(service.update(mockState.id, updateWithCode)).rejects.toThrow(ConflictException);
      await expect(service.update(mockState.id, updateWithCode)).rejects.toMatchObject({
        response: {
          i18nType: 'agent.state.duplicate_code',
        },
      });

      expect(repository.update).not.toHaveBeenCalled();
    });

    /**
     * Test updating to same code (should be allowed)
     */
    it('should allow updating to the same code', async () => {
      const updateWithSameCode: UpdateStateInput = { code: 'TX', name: 'Texas Renamed' };
      const updatedState: State = { ...mockState, name: 'Texas Renamed' };

      repository.findById.mockResolvedValue(mockState);
      repository.findByCode.mockResolvedValue(mockState); // Same state
      repository.update.mockResolvedValue(updatedState);

      const result = await service.update(mockState.id, updateWithSameCode);

      expect(result).toEqual(updatedState);
      expect(repository.update).toHaveBeenCalled();
    });
  });


  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 2.1
     */
    it('should return paginated states from repository', async () => {
      const mockStates = [
        { ...mockState, code: 'AL', name: 'Alabama' },
        { ...mockState, code: 'AK', name: 'Alaska' },
      ];

      repository.findPage.mockResolvedValue({
        items: mockStates,
        total: 50,
      });

      const result = await service.findPage({ offset: 0, limit: 25 });

      expect(result.states).toEqual(mockStates);
      expect(result.total).toBe(50);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 }, undefined);
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockState],
        total: 50,
      });

      const result = await service.findPage({ offset: 25, limit: 25 });

      expect(result.states).toHaveLength(1);
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

      expect(result.states).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test with field selection
     */
    it('should pass field selection to repository', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockState],
        total: 1,
      });

      const selection = { fields: ['id', 'name', 'code'], include: ['region'] };
      await service.findPage({ offset: 0, limit: 25 }, selection);

      expect(repository.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 }, selection);
    });

    /**
     * Test with filter, sort, and search
     */
    it('should pass filter, sort, and search to repository', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockState],
        total: 1,
      });

      const query = {
        offset: 0,
        limit: 25,
        filter: 'isActive:eq:true',
        sort: 'name:ASC',
        search: 'Texas',
      };

      await service.findPage(query);

      expect(repository.findPage).toHaveBeenCalledWith(query, undefined);
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
