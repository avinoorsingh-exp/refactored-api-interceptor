import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegionsController } from './regions.controller.js';
import { RegionsService } from './regions.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { Region } from '@exprealty/shared-domain';
import type { Response } from 'express';

/**
 * Unit tests for RegionsController
 * Tests create(), findAll(), findById(), update() with mocked service
 * Validates: Requirements 1.3, 1.7, 1.8
 */
describe('RegionsController', () => {
  let controller: RegionsController;
  let service: jest.Mocked<RegionsService>;

  const mockRegion: Region = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'southwest',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  const mockResponse = () => {
    const res: Partial<Response> = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findPage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      controllers: [RegionsController],
      providers: [
        {
          provide: RegionsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RegionsController>(RegionsController);
    service = module.get(RegionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/regions (create)', () => {
    const createDto = { name: 'Northeast' };

    /**
     * Test successful region creation
     * Validates: Requirements 1.3, 1.8
     */
    it('should create a new region successfully and set Location header', async () => {
      const newRegion: Region = {
        ...mockRegion,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'northeast',
      };
      service.create.mockResolvedValue(newRegion);

      const res = mockResponse();
      const result = await controller.create(createDto, res);

      expect(result).toEqual(newRegion);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/v1/regions/${newRegion.id}`,
      );
    });

    /**
     * Test duplicate name handling
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException for duplicate region name', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "A region with name 'Northeast' already exists",
          i18nType: 'agent.region.duplicate_name',
        }),
      );

      const res = mockResponse();

      await expect(controller.create(createDto, res)).rejects.toThrow(
        ConflictException,
      );
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test generic error propagation
     */
    it('should propagate unexpected errors from service', async () => {
      const error = new Error('Database connection failed');
      service.create.mockRejectedValue(error);

      const res = mockResponse();

      await expect(controller.create(createDto, res)).rejects.toThrow(error);
    });
  });

  describe('GET /v1/regions (findAll)', () => {
    /**
     * Test paginated list retrieval
     * Validates: Requirements 1.3
     */
    it('should return paginated regions with total count', async () => {
      const mockRegions = [
        { ...mockRegion, name: 'northeast' },
        { ...mockRegion, id: 'another-id', name: 'southwest' },
        { ...mockRegion, id: 'third-id', name: 'midwest' },
      ];

      service.findPage.mockResolvedValue({
        regions: mockRegions,
        total: 50,
      });

      const result = await controller.findAll({ offset: 0, limit: 25 });

      expect(result).toEqual({
        items: mockRegions,
        total: 50,
      });
      expect(service.findPage).toHaveBeenCalled();
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      const mockRegions = [{ ...mockRegion, name: 'pacific' }];

      service.findPage.mockResolvedValue({
        regions: mockRegions,
        total: 50,
      });

      const result = await controller.findAll({ offset: 25, limit: 25 });

      expect(result.items).toEqual(mockRegions);
      expect(result.total).toBe(50);
    });

    /**
     * Test empty result set
     */
    it('should handle empty result set', async () => {
      service.findPage.mockResolvedValue({
        regions: [],
        total: 0,
      });

      const result = await controller.findAll({ offset: 0, limit: 25 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('GET /v1/regions/:id (findById)', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 1.3
     */
    it('should return a region when found by ID', async () => {
      service.findById.mockResolvedValue(mockRegion);

      const result = await controller.findById({ id: mockRegion.id });

      expect(result).toEqual(mockRegion);
      expect(service.findById).toHaveBeenCalledWith(mockRegion.id);
    });

    /**
     * Test 404 not found scenario
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when region not found', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException({
          message: "Region with id 'non-existent-id' not found",
          i18nType: 'agent.region.not_found',
        }),
      );

      await expect(
        controller.findById({ id: 'non-existent-id' }),
      ).rejects.toThrow(NotFoundException);

      expect(service.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('PUT /v1/regions/:id (update)', () => {
    const updateDto = { name: 'Southwest Updated' };

    /**
     * Test successful region update
     * Validates: Requirements 1.3, 1.8
     */
    it('should update a region successfully', async () => {
      const updatedRegion: Region = {
        ...mockRegion,
        name: 'southwest updated',
      };
      service.update.mockResolvedValue(updatedRegion);

      const result = await controller.update(mockRegion.id, updateDto);

      expect(result).toEqual(updatedRegion);
      expect(service.update).toHaveBeenCalledWith(mockRegion.id, updateDto);
    });

    /**
     * Test 404 not found on update
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when updating non-existent region', async () => {
      service.update.mockRejectedValue(
        new NotFoundException({
          message: "Region with id 'non-existent-id' not found",
          i18nType: 'agent.region.not_found',
        }),
      );

      await expect(
        controller.update('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);

      expect(service.update).toHaveBeenCalledWith('non-existent-id', updateDto);
    });

    /**
     * Test duplicate name conflict on update
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException when updating to duplicate name', async () => {
      const updateWithName = { name: 'Northeast' };
      service.update.mockRejectedValue(
        new ConflictException({
          message: "A region with name 'Northeast' already exists",
          i18nType: 'agent.region.duplicate_name',
        }),
      );

      await expect(
        controller.update(mockRegion.id, updateWithName),
      ).rejects.toThrow(ConflictException);
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from service', async () => {
      const error = new Error('Database error');
      service.update.mockRejectedValue(error);

      await expect(
        controller.update(mockRegion.id, updateDto),
      ).rejects.toThrow(error);
    });
  });
});
