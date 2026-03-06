import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { LoggerService } from '../../core/logger.service.js';
import type { Company, CreateCompanyInput, UpdateCompanyInput } from '@exprealty/shared-domain';
import type { Response } from 'express';

/**
 * Unit tests for CompaniesController
 * Tests create(), findAll(), findOne(), update() with mocked service
 * Validates: Requirements 1.2, 1.7, 1.8
 */
describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: jest.Mocked<CompaniesService>;

  const mockCompany: Company = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'acme corporation',
    email: 'contact@acme.com',
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  const mockRequest = (): any => ({
    headers: { 'x-correlation-id': 'test-123' },
  });

  const mockResponse = () => {
    const res: Partial<Response> = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
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
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: mockService,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
    service = module.get(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/companies (create)', () => {
    const createDto: CreateCompanyInput = {
      name: 'Acme Corporation',
      email: 'contact@acme.com',
    };

    /**
     * Test successful company creation
     * Validates: Requirements 1.2, 1.8
     */
    it('should create a new company successfully and set Location header', async () => {
      const newCompany: Company = {
        ...mockCompany,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'acme corporation',
        email: 'contact@acme.com',
      };
      service.create.mockResolvedValue(newCompany);

      const res = mockResponse();
      const result = await controller.create(createDto, res);

      expect(result).toEqual(newCompany);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/v1/companies/${newCompany.id}`,
      );
    });

    /**
     * Test duplicate name handling
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException for duplicate company name', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "A company with name 'Acme Corporation' already exists",
          i18nType: 'agent.company.duplicate_name',
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

  describe('GET /v1/companies (findAll)', () => {
    /**
     * Test paginated list retrieval
     * Validates: Requirements 1.2
     */
    it('should return paginated companies with total count', async () => {
      const mockCompanies = [
        { ...mockCompany, name: 'alpha corp' },
        { ...mockCompany, name: 'beta inc' },
        { ...mockCompany, name: 'gamma llc' },
      ];

      service.findPage.mockResolvedValue({
        companies: mockCompanies,
        total: 50,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result).toEqual({
        items: mockCompanies,
        total: 50,
      });
      expect(service.findPage).toHaveBeenCalled();
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      const mockCompanies = [{ ...mockCompany, name: 'delta corp' }];

      service.findPage.mockResolvedValue({
        companies: mockCompanies,
        total: 50,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 25, limit: 25 }, req);

      expect(result.items).toEqual(mockCompanies);
      expect(result.total).toBe(50);
    });

    /**
     * Test empty result set
     */
    it('should handle empty result set', async () => {
      service.findPage.mockResolvedValue({
        companies: [],
        total: 0,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test error propagation from findAll
     */
    it('should propagate errors from service', async () => {
      const error = new Error('Database error');
      service.findPage.mockRejectedValue(error);

      const req = mockRequest();

      await expect(controller.findAll({ offset: 0, limit: 25 }, req)).rejects.toThrow(error);
    });
  });

  describe('GET /v1/companies/:id (findOne)', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 1.2
     */
    it('should return a company when found by ID', async () => {
      service.findById.mockResolvedValue(mockCompany);

      const result = await controller.findOne({ id: mockCompany.id }, {});

      expect(result).toEqual(mockCompany);
      expect(service.findById).toHaveBeenCalledWith(mockCompany.id, { fields: undefined, include: undefined });
    });

    /**
     * Test 404 not found scenario
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when company not found', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException({
          message: "Company with id 'non-existent-id' not found",
          i18nType: 'agent.company.not_found',
        }),
      );

      await expect(
        controller.findOne({ id: 'non-existent-id' }, {}),
      ).rejects.toThrow(NotFoundException);

      expect(service.findById).toHaveBeenCalledWith('non-existent-id', { fields: undefined, include: undefined });
    });
  });

  describe('PUT /v1/companies/:id (update)', () => {
    const updateDto: UpdateCompanyInput = {
      name: 'Acme Corporation Updated',
      email: 'updated@acme.com',
    };

    /**
     * Test successful company update
     * Validates: Requirements 1.2, 1.8
     */
    it('should update a company successfully', async () => {
      const updatedCompany: Company = {
        ...mockCompany,
        name: 'acme corporation updated',
        email: 'updated@acme.com',
      };
      service.update.mockResolvedValue(updatedCompany);

      const result = await controller.update({ id: mockCompany.id }, updateDto);

      expect(result).toEqual(updatedCompany);
      expect(service.update).toHaveBeenCalledWith(mockCompany.id, updateDto);
    });

    /**
     * Test 404 not found on update
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when updating non-existent company', async () => {
      service.update.mockRejectedValue(
        new NotFoundException({
          message: "Company with id 'non-existent-id' not found",
          i18nType: 'agent.company.not_found',
        }),
      );

      await expect(
        controller.update({ id: 'non-existent-id' }, updateDto),
      ).rejects.toThrow(NotFoundException);

      expect(service.update).toHaveBeenCalledWith('non-existent-id', updateDto);
    });

    /**
     * Test duplicate name conflict on update
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException when updating to duplicate name', async () => {
      service.update.mockRejectedValue(
        new ConflictException({
          message: "A company with name 'Existing Corp' already exists",
          i18nType: 'agent.company.duplicate_name',
        }),
      );

      await expect(
        controller.update({ id: mockCompany.id }, updateDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Correlation ID handling', () => {
    /**
     * Test that controller handles requests with correlation ID header
     */
    it('should handle requests with x-correlation-id header', async () => {
      service.findPage.mockResolvedValue({
        companies: [mockCompany],
        total: 1,
      });

      const req = { headers: { 'x-correlation-id': 'custom-correlation-123' } };
      const result = await controller.findAll({ offset: 0, limit: 25 }, req as any);

      expect(result.items).toEqual([mockCompany]);
    });

    /**
     * Test that controller handles requests with x-request-id header
     */
    it('should handle requests with x-request-id header', async () => {
      service.findPage.mockResolvedValue({
        companies: [mockCompany],
        total: 1,
      });

      const req = { headers: { 'x-request-id': 'request-id-456' } };
      const result = await controller.findAll({ offset: 0, limit: 25 }, req as any);

      expect(result.items).toEqual([mockCompany]);
    });

    /**
     * Test that controller handles requests without correlation ID
     */
    it('should handle requests without correlation ID header', async () => {
      service.findPage.mockResolvedValue({
        companies: [mockCompany],
        total: 1,
      });

      const req = { headers: {} };
      const result = await controller.findAll({ offset: 0, limit: 25 }, req as any);

      expect(result.items).toEqual([mockCompany]);
    });
  });
});
