import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayPlansController } from './pay-plans.controller.js';
import { PayPlansService } from './pay-plans.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { PayPlan } from '@exprealty/shared-domain';
import type { Response, Request } from 'express';

/**
 * Unit tests for PayPlansController
 * Tests create(), findAll(), findById(), update() with mocked service
 * Validates: Requirements 1.4, 1.7, 1.8
 */
describe('PayPlansController', () => {
  let controller: PayPlansController;
  let service: jest.Mocked<PayPlansService>;

  const mockPayPlan: PayPlan = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Standard Plan',
    active: true,
    agentPercentage: 80,
    cap: 16000,
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
      path: '/v1/payplans',
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
      findPage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      controllers: [PayPlansController],
      providers: [
        {
          provide: PayPlansService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PayPlansController>(PayPlansController);
    service = module.get(PayPlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/payplans (create)', () => {
    const createDto = {
      name: 'Premium Plan',
      active: true,
      agentPercentage: 85,
      cap: 20000,
    };

    /**
     * Test successful pay plan creation
     * Validates: Requirements 1.4, 1.8
     */
    it('should create a new pay plan successfully and set Location header', async () => {
      const newPayPlan: PayPlan = {
        ...mockPayPlan,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Premium Plan',
        agentPercentage: 85,
        cap: 20000,
      };
      service.create.mockResolvedValue(newPayPlan);

      const res = mockResponse();
      const req = mockRequest();
      const result = await controller.create(createDto, res, req);

      expect(result).toEqual(newPayPlan);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/v1/payplans/${newPayPlan.id}`,
      );
    });

    /**
     * Test duplicate name handling
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException for duplicate pay plan name', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "A pay plan with name 'Premium Plan' already exists",
          i18nType: 'agent.payplan.duplicate_name',
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

  describe('GET /v1/payplans (findAll)', () => {
    /**
     * Test paginated list retrieval
     * Validates: Requirements 1.4
     */
    it('should return paginated pay plans with total count', async () => {
      const mockPayPlans = [
        { ...mockPayPlan, name: 'Standard Plan' },
        { ...mockPayPlan, id: 'another-id', name: 'Premium Plan' },
        { ...mockPayPlan, id: 'third-id', name: 'Elite Plan' },
      ];

      service.findPage.mockResolvedValue({
        payPlans: mockPayPlans,
        total: 50,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result).toEqual({
        items: mockPayPlans,
        total: 50,
      });
      expect(service.findPage).toHaveBeenCalled();
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      const mockPayPlans = [{ ...mockPayPlan, name: 'Elite Plan' }];

      service.findPage.mockResolvedValue({
        payPlans: mockPayPlans,
        total: 50,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 25, limit: 25 }, req);

      expect(result.items).toEqual(mockPayPlans);
      expect(result.total).toBe(50);
    });

    /**
     * Test empty result set
     */
    it('should handle empty result set', async () => {
      service.findPage.mockResolvedValue({
        payPlans: [],
        total: 0,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test with field selection
     */
    it('should pass field selection to service', async () => {
      service.findPage.mockResolvedValue({
        payPlans: [mockPayPlan],
        total: 1,
      });

      const req = mockRequest();
      const query = { offset: 0, limit: 25, fields: 'id,name,active' };
      await controller.findAll(query, req);

      expect(service.findPage).toHaveBeenCalledWith(
        query,
        expect.objectContaining({
          fields: ['id', 'name', 'active'],
        }),
      );
    });
  });

  describe('GET /v1/payplans/:id (findById)', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 1.4
     */
    it('should return a pay plan when found by ID', async () => {
      service.findById.mockResolvedValue(mockPayPlan);

      const req = mockRequest();
      const result = await controller.findById({ id: mockPayPlan.id }, req);

      expect(result).toEqual(mockPayPlan);
      expect(service.findById).toHaveBeenCalledWith(mockPayPlan.id);
    });

    /**
     * Test 404 not found scenario
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when pay plan not found', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException({
          message: "Pay plan with id 'non-existent-id' not found",
          i18nType: 'agent.payplan.not_found',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.findById({ id: 'non-existent-id' }, req),
      ).rejects.toThrow(NotFoundException);

      expect(service.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('PUT /v1/payplans/:id (update)', () => {
    const updateDto = { name: 'Updated Plan', agentPercentage: 90 };

    /**
     * Test successful pay plan update
     * Validates: Requirements 1.4, 1.8
     */
    it('should update a pay plan successfully', async () => {
      const updatedPayPlan: PayPlan = {
        ...mockPayPlan,
        name: 'Updated Plan',
        agentPercentage: 90,
      };
      service.update.mockResolvedValue(updatedPayPlan);

      const req = mockRequest();
      const result = await controller.update({ id: mockPayPlan.id }, updateDto, req);

      expect(result).toEqual(updatedPayPlan);
      expect(service.update).toHaveBeenCalledWith(mockPayPlan.id, updateDto);
    });

    /**
     * Test 404 not found on update
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when updating non-existent pay plan', async () => {
      service.update.mockRejectedValue(
        new NotFoundException({
          message: "Pay plan with id 'non-existent-id' not found",
          i18nType: 'agent.payplan.not_found',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.update({ id: 'non-existent-id' }, updateDto, req),
      ).rejects.toThrow(NotFoundException);

      expect(service.update).toHaveBeenCalledWith('non-existent-id', updateDto);
    });

    /**
     * Test duplicate name conflict on update
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException when updating to duplicate name', async () => {
      const updateWithName = { name: 'Existing Plan' };
      service.update.mockRejectedValue(
        new ConflictException({
          message: "A pay plan with name 'Existing Plan' already exists",
          i18nType: 'agent.payplan.duplicate_name',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.update({ id: mockPayPlan.id }, updateWithName, req),
      ).rejects.toThrow(ConflictException);
    });

    /**
     * Test error propagation
     */
    it('should propagate unexpected errors from service', async () => {
      const error = new Error('Database error');
      service.update.mockRejectedValue(error);

      const req = mockRequest();

      await expect(
        controller.update({ id: mockPayPlan.id }, updateDto, req),
      ).rejects.toThrow(error);
    });
  });
});
