import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatesController } from './states.controller.js';
import { StatesService } from './states.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { State, CreateStateInput, UpdateStateInput } from '@exprealty/shared-domain';
import type { Response } from 'express';

/**
 * Unit tests for StatesController
 * Tests create(), findAll(), findById(), update() with mocked service
 * Validates: Requirements 1.1, 1.7, 1.8
 */
describe('StatesController', () => {
  let controller: StatesController;
  let service: jest.Mocked<StatesService>;

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

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      update: jest.fn(),
      findPage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      controllers: [StatesController],
      providers: [
        {
          provide: StatesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<StatesController>(StatesController);
    service = module.get(StatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });


  describe('POST /v1/states (create)', () => {
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
     * Validates: Requirements 1.1, 1.8
     */
    it('should create a new state successfully and set Location header', async () => {
      const newState: State = {
        ...mockState,
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'California',
        code: 'CA',
        regionId: '2',
        email: 'california@example.com',
      };
      service.create.mockResolvedValue(newState);

      const req = mockRequest();
      const res = mockResponse();
      const result = await controller.create(createDto, res, req);

      expect(result).toEqual(newState);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/v1/states/${newState.id}`,
      );
    });

    /**
     * Test duplicate code handling
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException for duplicate state code', async () => {
      service.create.mockRejectedValue(
        new ConflictException({
          message: "A state with code 'CA' already exists",
          i18nType: 'agent.state.duplicate_code',
        }),
      );

      const req = mockRequest();
      const res = mockResponse();

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

      const req = mockRequest();
      const res = mockResponse();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(error);
    });
  });

  describe('GET /v1/states (findAll)', () => {
    /**
     * Test paginated list retrieval
     * Validates: Requirements 1.1
     */
    it('should return paginated states with total count', async () => {
      const mockStates = [
        { ...mockState, code: 'AL', name: 'Alabama' },
        { ...mockState, code: 'AK', name: 'Alaska' },
        { ...mockState, code: 'AZ', name: 'Arizona' },
      ];

      service.findPage.mockResolvedValue({
        states: mockStates,
        total: 50,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result).toEqual({
        items: mockStates,
        total: 50,
      });
      expect(service.findPage).toHaveBeenCalled();
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      const mockStates = [{ ...mockState, code: 'CA', name: 'California' }];

      service.findPage.mockResolvedValue({
        states: mockStates,
        total: 50,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 25, limit: 25 }, req);

      expect(result.items).toEqual(mockStates);
      expect(result.total).toBe(50);
    });

    /**
     * Test empty result set
     */
    it('should handle empty result set', async () => {
      service.findPage.mockResolvedValue({
        states: [],
        total: 0,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test field selection via query params
     */
    it('should pass field selection to service', async () => {
      service.findPage.mockResolvedValue({
        states: [mockState],
        total: 1,
      });

      const req = mockRequest();
      const query = { offset: 0, limit: 25, fields: 'id,name,code', include: 'region' };
      await controller.findAll(query, req);

      expect(service.findPage).toHaveBeenCalledWith(
        query,
        {
          fields: ['id', 'name', 'code'],
          include: ['region'],
        },
      );
    });
  });


  describe('GET /v1/states/:id (findById)', () => {
    /**
     * Test successful retrieval by ID
     * Validates: Requirements 1.1
     */
    it('should return a state when found by ID', async () => {
      service.findById.mockResolvedValue(mockState);

      const req = mockRequest();
      const result = await controller.findById({ id: mockState.id }, req);

      expect(result).toEqual(mockState);
      expect(service.findById).toHaveBeenCalledWith(mockState.id);
    });

    /**
     * Test 404 not found scenario
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when state not found', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException({
          message: "State with id 'non-existent-id' not found",
          i18nType: 'agent.state.not_found',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.findById({ id: 'non-existent-id' }, req),
      ).rejects.toThrow(NotFoundException);

      expect(service.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('PUT /v1/states/:id (update)', () => {
    const updateDto: UpdateStateInput = {
      name: 'Texas Updated',
      isActive: false,
    };

    /**
     * Test successful state update
     * Validates: Requirements 1.1, 1.8
     */
    it('should update a state successfully', async () => {
      const updatedState: State = {
        ...mockState,
        name: 'Texas Updated',
        isActive: false,
      };
      service.update.mockResolvedValue(updatedState);

      const req = mockRequest();
      const result = await controller.update({ id: mockState.id }, updateDto, req);

      expect(result).toEqual(updatedState);
      expect(service.update).toHaveBeenCalledWith(mockState.id, updateDto);
    });

    /**
     * Test 404 not found on update
     * Validates: Requirements 1.7
     */
    it('should throw NotFoundException when updating non-existent state', async () => {
      service.update.mockRejectedValue(
        new NotFoundException({
          message: "State with id 'non-existent-id' not found",
          i18nType: 'agent.state.not_found',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.update({ id: 'non-existent-id' }, updateDto, req),
      ).rejects.toThrow(NotFoundException);

      expect(service.update).toHaveBeenCalledWith('non-existent-id', updateDto);
    });

    /**
     * Test duplicate code conflict on update
     * Validates: Requirements 1.7
     */
    it('should throw ConflictException when updating to duplicate code', async () => {
      const updateWithCode: UpdateStateInput = { code: 'CA' };
      service.update.mockRejectedValue(
        new ConflictException({
          message: "A state with code 'CA' already exists",
          i18nType: 'agent.state.duplicate_code',
        }),
      );

      const req = mockRequest();

      await expect(
        controller.update({ id: mockState.id }, updateWithCode, req),
      ).rejects.toThrow(ConflictException);
    });

    /**
     * Test partial update
     */
    it('should handle partial updates correctly', async () => {
      const partialUpdate: UpdateStateInput = { email: 'new-email@example.com' };
      const updatedState: State = {
        ...mockState,
        email: 'new-email@example.com',
      };
      service.update.mockResolvedValue(updatedState);

      const req = mockRequest();
      const result = await controller.update({ id: mockState.id }, partialUpdate, req);

      expect(result.email).toBe('new-email@example.com');
      expect(service.update).toHaveBeenCalledWith(mockState.id, partialUpdate);
    });
  });

  describe('Correlation ID handling', () => {
    /**
     * Test that controller handles requests with correlation ID header
     */
    it('should handle requests with x-correlation-id header', async () => {
      service.findById.mockResolvedValue(mockState);

      const req = { headers: { 'x-correlation-id': 'custom-correlation-123' } };
      const result = await controller.findById({ id: mockState.id }, req as any);

      expect(result).toEqual(mockState);
    });

    /**
     * Test that controller handles requests with x-request-id header
     */
    it('should handle requests with x-request-id header', async () => {
      service.findById.mockResolvedValue(mockState);

      const req = { headers: { 'x-request-id': 'request-id-456' } };
      const result = await controller.findById({ id: mockState.id }, req as any);

      expect(result).toEqual(mockState);
    });

    /**
     * Test that controller handles requests without correlation ID
     */
    it('should handle requests without correlation ID header', async () => {
      service.findById.mockResolvedValue(mockState);

      const req = { headers: {} };
      const result = await controller.findById({ id: mockState.id }, req as any);

      expect(result).toEqual(mockState);
    });
  });
});

/**
 * UUID Validation Tests for States Controller
 * Tests AC3 for GET /states/{id}: Invalid UUID format returns 400 Bad Request
 * Validates: Requirements 1.7
 */
describe('StatesController UUID Validation', () => {
  const { StateIdParamSchema } = require('@exprealty/shared-domain');
  const { ZodValidationPipe } = require('../../common/zod-validation.pipe.js');

  const validationPipe = new ZodValidationPipe(StateIdParamSchema, 'agent.state.validation');

  describe('GET /v1/states/:id - UUID format validation (AC3)', () => {
    /**
     * Test valid UUID format passes validation
     */
    it('should accept valid UUID format', async () => {
      const validUuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      ];

      for (const uuid of validUuids) {
        const result = await validationPipe.transform({ id: uuid }, { type: 'param' });
        expect(result.id).toBe(uuid);
      }
    });

    /**
     * Test invalid UUID format throws BadRequestException
     * AC3: Given {id} is not a valid UUID format, Then return 400 Bad Request
     */
    it('should reject invalid UUID format with BadRequestException', () => {
      const invalidUuids = [
        'not-a-uuid',
        '12345',
        'invalid-uuid-format',
        '550e8400-e29b-41d4-a716', // incomplete
        '550e8400e29b41d4a716446655440000', // missing dashes
        'ZZZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZZZZZZZZZ', // invalid characters
        '', // empty string
      ];

      for (const invalidUuid of invalidUuids) {
        expect(() =>
          validationPipe.transform({ id: invalidUuid }, { type: 'param' })
        ).toThrow();
      }
    });

    /**
     * Test that validation error includes machine-readable error details
     * AC3: Return 400 Bad Request with a machine-readable error
     */
    it('should include machine-readable error details for invalid UUID', async () => {
      try {
        await validationPipe.transform({ id: 'not-a-uuid' }, { type: 'param' });
        fail('Expected validation to throw');
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        const response = error.getResponse();
        expect(response._zodIssues).toBeDefined();
        expect(response._i18nType).toBe('agent.state.validation');
      }
    });

    /**
     * Test missing id parameter
     */
    it('should reject missing id parameter', () => {
      expect(() =>
        validationPipe.transform({}, { type: 'param' })
      ).toThrow();
    });

    /**
     * Test null id parameter
     */
    it('should reject null id parameter', () => {
      expect(() =>
        validationPipe.transform({ id: null }, { type: 'param' })
      ).toThrow();
    });
  });

  describe('PUT /v1/states/:id - UUID format validation (AC3)', () => {
    /**
     * Test that PUT endpoint also validates UUID format
     */
    it('should reject invalid UUID format on update endpoint', () => {
      expect(() =>
        validationPipe.transform({ id: 'invalid-uuid' }, { type: 'param' })
      ).toThrow();
    });
  });
});
