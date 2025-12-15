import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MLSController } from './mls.controller.js';
import { MLSService } from './mls.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { MLSType } from '@exprealty/shared-domain';
import type { Response, Request } from 'express';

/**
 * Unit tests for MLSController
 * Tests create(), findAll(), findById(), update() with mocked service
 */
describe('MLSController', () => {
  let controller: MLSController;
  let service: jest.Mocked<MLSService>;

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

  const mockResponse = () => {
    const res: Partial<Response> = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  const mockRequest = () => {
    const req: Partial<Request> = {
      headers: { 'x-correlation-id': 'test-correlation-id' },
      path: '/v1/mls',
      method: 'GET',
    };
    return req as Request;
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      controllers: [MLSController],
      providers: [
        {
          provide: MLSService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MLSController>(MLSController);
    service = module.get(MLSService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/mls (create)', () => {
    const createDto = {
      name: 'New MLS Service',
      lifecycleStatus: 'active' as const,
      orgType: 'mls' as const,
      ouid: 'new-mls-123',
      globalId: 200,
    };

    /**
     * Test successful MLS creation
     */
    it('should create a new MLS successfully and set Location header', async () => {
      const newMLS: MLSType = {
        ...mockMLS,
        id: '12346',
        name: 'New MLS Service',
        ouid: 'new-mls-123',
        globalId: 200,
      };
      service.create.mockResolvedValue(newMLS);

      const res = mockResponse();
      const req = mockRequest();
      const result = await controller.create(createDto, res, req);

      expect(result).toEqual(newMLS);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/v1/mls/${newMLS.id}`,
      );
    });

    /**
     * Test duplicate name handling
     */
    it('should throw ConflictException for duplicate MLS name', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "An MLS with name 'New MLS Service' already exists",
          i18nType: 'agent.mls.duplicate_name',
        }),
      );

      const res = mockResponse();
      const req = mockRequest();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(
        ConflictException,
      );
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test duplicate global_id handling
     */
    it('should throw ConflictException for duplicate global_id', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "An MLS with global_id '200' already exists",
          i18nType: 'agent.mls.duplicate_global_id',
        }),
      );

      const res = mockResponse();
      const req = mockRequest();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(
        ConflictException,
      );
    });

    /**
     * Test generic error propagation
     */
    it('should propagate unexpected errors from service', async () => {
      const error = new Error('Database connection failed');
      service.create.mockRejectedValue(error);

      const res = mockResponse();
      const req = mockRequest();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(error);
    });
  });

  describe('GET /v1/mls (findAll)', () => {
    /**
     * Test paginated list retrieval
     */
    it('should return paginated MLS records with total count', async () => {
      const mockMLSList = [
        { ...mockMLS, name: 'MLS 1' },
        { ...mockMLS, id: '12346', name: 'MLS 2' },
      ];
      service.findAll.mockResolvedValue({ data: mockMLSList, total: 2 });

      const req = mockRequest();
      const query = { offset: 0, limit: 25 };
      const result = await controller.findAll(query, req);

      expect(result).toEqual({ items: mockMLSList, total: 2 });
      expect(service.findAll).toHaveBeenCalled();
    });

    /**
     * Test empty result
     */
    it('should return empty array when no MLS records found', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0 });

      const req = mockRequest();
      const query = { offset: 0, limit: 25 };
      const result = await controller.findAll(query, req);

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('GET /v1/mls/:id (findById)', () => {
    /**
     * Test successful retrieval by ID
     */
    it('should return MLS when found by ID', async () => {
      service.findById.mockResolvedValue(mockMLS);

      const req = mockRequest();
      const result = await controller.findById({ id: mockMLS.id }, req);

      expect(result).toEqual(mockMLS);
      expect(service.findById).toHaveBeenCalledWith(mockMLS.id);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when MLS not found', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException({
          message: "MLS with id '99999' not found",
          i18nType: 'agent.mls.not_found',
        }),
      );

      const req = mockRequest();

      await expect(controller.findById({ id: '99999' }, req)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.findById).toHaveBeenCalledWith('99999');
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from service', async () => {
      const error = new Error('Database error');
      service.findById.mockRejectedValue(error);

      const req = mockRequest();

      await expect(controller.findById({ id: mockMLS.id }, req)).rejects.toThrow(error);
    });
  });

  describe('PUT /v1/mls/:id (update)', () => {
    const updateDto = {
      name: 'Updated MLS Name',
      lifecycleStatus: 'archived' as const,
    };

    /**
     * Test successful update
     */
    it('should update MLS successfully', async () => {
      const updatedMLS: MLSType = {
        ...mockMLS,
        name: 'Updated MLS Name',
        lifecycleStatus: 'archived',
      };
      service.update.mockResolvedValue(updatedMLS);

      const req = mockRequest();
      const result = await controller.update({ id: mockMLS.id }, updateDto, req);

      expect(result).toEqual(updatedMLS);
      expect(service.update).toHaveBeenCalledWith(mockMLS.id, updateDto);
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when MLS not found', async () => {
      service.update.mockRejectedValue(
        new NotFoundException({
          message: "MLS with id '99999' not found",
          i18nType: 'agent.mls.not_found',
        }),
      );

      const req = mockRequest();

      await expect(controller.update({ id: '99999' }, updateDto, req)).rejects.toThrow(
        NotFoundException,
      );
    });

    /**
     * Test duplicate name conflict
     */
    it('should throw ConflictException for duplicate name', async () => {
      service.update.mockRejectedValue(
        new ConflictException({
          message: "An MLS with name 'Updated MLS Name' already exists",
          i18nType: 'agent.mls.duplicate_name',
        }),
      );

      const req = mockRequest();

      await expect(controller.update({ id: mockMLS.id }, updateDto, req)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
