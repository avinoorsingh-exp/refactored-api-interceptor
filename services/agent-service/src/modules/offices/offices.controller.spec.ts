import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OfficesController } from './offices.controller.js';
import { OfficesService } from './offices.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { Office } from '@exprealty/shared-domain';
import type { Response, Request } from 'express';

/**
 * Unit tests for OfficesController
 * Tests create(), findAll(), findById(), update() with mocked service
 */
describe('OfficesController', () => {
  let controller: OfficesController;
  let service: jest.Mocked<OfficesService>;

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
      path: '/v1/offices',
      method: 'GET',
    };
    return req as Request;
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByCompanyId: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      controllers: [OfficesController],
      providers: [
        {
          provide: OfficesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<OfficesController>(OfficesController);
    service = module.get(OfficesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/offices (create)', () => {
    const createDto = {
      name: 'New Branch Office',
      website: 'https://new-office.example.com',
      phone: '555-987-6543',
      lifecycleStatus: 'new' as const,
      primaryState: 'Texas',
      companyId: '67890',
    };

    /**
     * Test successful office creation
     */
    it('should create a new office successfully and set Location header', async () => {
      const newOffice: Office = {
        ...mockOffice,
        id: '12346',
        name: 'New Branch Office',
        website: 'https://new-office.example.com' as Office['website'],
        phone: '555-987-6543',
        lifecycleStatus: 'new',
        primaryState: 'Texas',
      };
      service.create.mockResolvedValue(newOffice);

      const res = mockResponse();
      const req = mockRequest();
      const result = await controller.create(createDto, res, req);

      expect(result).toEqual(newOffice);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/v1/offices/${newOffice.id}`,
      );
    });

    /**
     * Test duplicate name handling
     */
    it('should throw ConflictException for duplicate office name', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "An office with name 'New Branch Office' already exists",
          i18nType: 'agent.office.duplicate_name',
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

  describe('GET /v1/offices (findAll)', () => {
    /**
     * Test paginated list retrieval
     */
    it('should return paginated offices with total count', async () => {
      const mockOffices = [
        { ...mockOffice, name: 'Office 1' },
        { ...mockOffice, id: '12346', name: 'Office 2' },
      ];
      service.findAll.mockResolvedValue({ data: mockOffices, total: 2 });

      const req = mockRequest();
      const query = { offset: 0, limit: 25 };
      const result = await controller.findAll(query, req);

      expect(result).toEqual({ items: mockOffices, total: 2 });
      expect(service.findAll).toHaveBeenCalled();
    });

    /**
     * Test empty result
     */
    it('should return empty array when no offices found', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0 });

      const req = mockRequest();
      const query = { offset: 0, limit: 25 };
      const result = await controller.findAll(query, req);

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('GET /v1/offices/:id (findById)', () => {
    /**
     * Test successful retrieval by ID
     */
    it('should return office when found by ID', async () => {
      service.findById.mockResolvedValue(mockOffice);

      const req = mockRequest();
      const result = await controller.findById({ id: mockOffice.id }, {}, req);

      expect(result).toEqual(mockOffice);
      expect(service.findById).toHaveBeenCalledWith(mockOffice.id, { fields: undefined, include: undefined });
    });

    /**
     * Test not found scenario
     */
    it('should throw NotFoundException when office not found', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException({
          message: "Office with id '99999' not found",
          i18nType: 'agent.office.not_found',
        }),
      );

      const req = mockRequest();

      await expect(controller.findById({ id: '99999' }, {}, req)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.findById).toHaveBeenCalledWith('99999', { fields: undefined, include: undefined });
    });
  });

  describe('PUT /v1/offices/:id (update)', () => {
    const updateDto = {
      name: 'Updated Office Name',
      lifecycleStatus: 'pending_due_diligence' as const,
    };

    /**
     * Test successful update
     */
    it('should update an office successfully', async () => {
      const updatedOffice: Office = {
        ...mockOffice,
        name: 'Updated Office Name',
        lifecycleStatus: 'pending_due_diligence',
      };
      service.update.mockResolvedValue(updatedOffice);

      const req = mockRequest();
      const result = await controller.update({ id: mockOffice.id }, updateDto, req);

      expect(result).toEqual(updatedOffice);
      expect(service.update).toHaveBeenCalledWith(mockOffice.id, updateDto);
    });

    /**
     * Test not found scenario on update
     */
    it('should throw NotFoundException when office to update not found', async () => {
      service.update.mockRejectedValue(
        new NotFoundException({
          message: "Office with id '99999' not found",
          i18nType: 'agent.office.not_found',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.update({ id: '99999' }, updateDto, req),
      ).rejects.toThrow(NotFoundException);
      expect(service.update).toHaveBeenCalledWith('99999', updateDto);
    });

    /**
     * Test duplicate name conflict on update
     */
    it('should throw ConflictException when updating to existing name', async () => {
      service.update.mockRejectedValue(
        new ConflictException({
          message: "An office with name 'Updated Office Name' already exists",
          i18nType: 'agent.office.duplicate_name',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.update({ id: mockOffice.id }, updateDto, req),
      ).rejects.toThrow(ConflictException);
    });
  });
});
