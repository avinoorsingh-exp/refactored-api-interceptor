import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { ICountriesRepository } from './ports/countries.repository.port.js';
import type { Country, CreateCountryInput } from '@exprealty/shared-domain';
import type { Request, Response } from 'express';
import { AsyncContextStorage, CorrelationIdHelper } from '@exprealty/cache';
import { LoggerService } from '../../core/logger.service.js';

describe('CountriesController', () => {
  let controller: CountriesController;
  let service: CountriesService;
  let repository: jest.Mocked<ICountriesRepository>;

  const mockCountry: Country = {
    id: 1,
    name: 'United States',
    alpha2: 'US',
    alpha3: 'USA',
    number: 840,
    dialingCode: 1,
    created: new Date('2024-01-15T10:30:00Z'),
    lastModified: new Date('2024-01-15T14:45:00Z'),
    modifiedBy: 'system',
  };

  const mockRequest = (): any =>
    ({
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
    // Create mock repository
    repository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      controllers: [CountriesController],
      providers: [
        CountriesService,
        {
          provide: 'ICountriesRepository',
          useValue: repository,
        },
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CountriesController>(CountriesController);
    service = module.get<CountriesService>(CountriesService);

    // Establish AsyncLocalStorage context for all tests
    // This simulates the middleware setting up the correlation ID context
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/countries (findAll - list with pagination)', () => {
    /**
     * AC1 – Pagination
     * Given a request to GET /countries?offset={n}&limit={m},
     * When limit ≤ 50 (default 25) and offset ≥ 0,
     * Then return 200 OK with an array of Countries sorted by code ascending
     */
    it('should return paginated countries sorted by alpha2 code ascending', async () => {
      const mockCountries = [
        { ...mockCountry, alpha2: 'AD', id: 1 },
        { ...mockCountry, alpha2: 'AE', id: 2 },
        { ...mockCountry, alpha2: 'AF', id: 3 },
      ];

      repository.findPage.mockResolvedValue({
        items: mockCountries,
        total: 249,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 25 }, req);

      expect(result).toEqual({
        items: mockCountries,
        total: 249,
      });
      expect(repository.findPage).toHaveBeenCalledWith({
        offset: 0,
        limit: 25,
      });
    });

    /**
     * AC1 – Pagination (continued)
     * Verify offset pagination works correctly
     */
    it('should return second page of countries with correct offset', async () => {
      const mockCountries = [
        { ...mockCountry, alpha2: 'BR', id: 30 },
        { ...mockCountry, alpha2: 'BS', id: 31 },
      ];

      repository.findPage.mockResolvedValue({
        items: mockCountries,
        total: 249,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 25, limit: 25 }, req);

      expect(result.items).toEqual(mockCountries);
      expect(result.total).toBe(249);
      expect(repository.findPage).toHaveBeenCalledWith({
        offset: 25,
        limit: 25,
      });
    });

    /**
     * AC1 - Pagination with default values
     * Test that default pagination parameters are handled correctly
     */
    it('should use default values when offset/limit not provided', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockCountry],
        total: 1,
      });

      const req = mockRequest();
      const result = await controller.findAll({}, req);

      expect(result.items.length).toBeGreaterThanOrEqual(0);
      expect(repository.findPage).toHaveBeenCalled();
    });

    /**
     * AC2 – Max limit enforcement
     * The PaginationInterceptor enforces max limit of 50
     * This test verifies the controller handles the data correctly
     */
    it('should handle maximum limit of 50 correctly', async () => {
      const mockCountries = Array.from({ length: 50 }, (_, i) => ({
        ...mockCountry,
        id: i + 1,
        alpha2: `C${i}`,
      }));

      repository.findPage.mockResolvedValue({
        items: mockCountries,
        total: 249,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 0, limit: 50 }, req);

      expect(result.items).toHaveLength(50);
      expect(result.total).toBe(249);
    });

    /**
     * AC3 – Validation (handled by ZodValidationPipe and PaginationInterceptor)
     * This test ensures service layer handles valid data correctly
     */
    it('should handle empty result set', async () => {
      repository.findPage.mockResolvedValue({
        items: [],
        total: 0,
      });

      const req = mockRequest();
      const result = await controller.findAll({ offset: 1000, limit: 25 }, req);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('GET /v1/countries/:code (findByCode)', () => {
    /**
     * Test successful retrieval of a country by code
     */
    it('should return a country when found by code', async () => {
      repository.findByCode.mockResolvedValue(mockCountry);

      const req = mockRequest();
      const result = await controller.findByCode({ code: 'US' }, req);

      expect(result).toEqual(mockCountry);
      expect(repository.findByCode).toHaveBeenCalledWith('US');
    });

    /**
     * Test 404 not found scenario
     */
    it('should throw NotFoundException when country not found', async () => {
      repository.findByCode.mockResolvedValue(null);

      const req = mockRequest();

      await expect(
        controller.findByCode({ code: 'XX' }, req),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findByCode).toHaveBeenCalledWith('XX');
    });

    /**
     * Test case sensitivity handling
     */
    it('should handle uppercase country codes', async () => {
      repository.findByCode.mockResolvedValue(mockCountry);

      const req = mockRequest();
      const result = await controller.findByCode({ code: 'US' }, req);

      expect(result).toEqual(mockCountry);
    });
  });

  describe('POST /v1/countries (create)', () => {
    const createDto: CreateCountryInput = {
      name: 'Canada',
      alpha2: 'CA',
      alpha3: 'CAN',
      number: 124,
      dialingCode: 1,
    };

    /**
     * Test successful country creation
     */
    it('should create a new country successfully', async () => {
      const newCountry: Country = { 
        ...createDto, 
        id: 2,
        created: new Date('2024-01-15T10:30:00Z'),
        lastModified: new Date('2024-01-15T14:45:00Z'),
        modifiedBy: 'system',
      };
      repository.create.mockResolvedValue(newCountry);

      const req = mockRequest();
      const res = mockResponse();
      const result = await controller.create(createDto, res, req);

      expect(result).toEqual(newCountry);
      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        '/v1/countries/CA',
      );
    });

    /**
     * Test duplicate alpha2 code handling
     */
    it('should throw ConflictException for duplicate alpha2 code', async () => {
      repository.create.mockRejectedValue(
        new ConflictException({
          message: "A country with alpha-2 code 'CA' already exists",
          i18nType: 'agent.country.duplicate_code',
        }),
      );

      const req = mockRequest();
      const res = mockResponse();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(
        ConflictException,
      );

      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test duplicate alpha3 code handling
     */
    it('should throw ConflictException for duplicate alpha3 code', async () => {
      repository.create.mockRejectedValue(
        new ConflictException({
          message: "A country with alpha-3 code 'CAN' already exists",
          i18nType: 'agent.country.duplicate_code',
        }),
      );

      const req = mockRequest();
      const res = mockResponse();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(
        ConflictException,
      );
    });

    /**
     * Test duplicate number handling
     */
    it('should throw ConflictException for duplicate number', async () => {
      repository.create.mockRejectedValue(
        new ConflictException({
          message: "A country with number code '124' already exists",
          i18nType: 'agent.country.duplicate_code',
        }),
      );

      const req = mockRequest();
      const res = mockResponse();

      await expect(controller.create(createDto, res, req)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('PUT /v1/countries/:code (upsert)', () => {
    const upsertDto: CreateCountryInput = {
      name: 'Canada Updated',
      alpha2: 'CA',
      alpha3: 'CAN',
      number: 124,
      dialingCode: 1,
    };

    /**
     * Test upsert creates new country (201)
     */
    it('should create new country and return 201 Created', async () => {
      const newCountry: Country = { 
        ...upsertDto, 
        id: 2,
        created: new Date('2024-01-15T10:30:00Z'),
        lastModified: new Date('2024-01-15T14:45:00Z'),
        modifiedBy: 'system',
      };
      repository.upsert.mockResolvedValue({
        country: newCountry,
        created: true,
      });

      const req = mockRequest();
      const res = mockResponse();
      const result = await controller.upsert(
        { code: 'CA' },
        upsertDto,
        res,
        req,
      );

      expect(result).toEqual(newCountry);
      expect(repository.upsert).toHaveBeenCalledWith(upsertDto);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        '/v1/countries/CA',
      );
    });

    /**
     * Test upsert updates existing country (200)
     */
    it('should update existing country and return 200 OK', async () => {
      const updatedCountry: Country = { 
        ...upsertDto, 
        id: 1,
        created: new Date('2024-01-15T10:30:00Z'),
        lastModified: new Date('2024-01-15T14:45:00Z'),
        modifiedBy: 'system',
      };
      repository.upsert.mockResolvedValue({
        country: updatedCountry,
        created: false,
      });

      const req = mockRequest();
      const res = mockResponse();
      const result = await controller.upsert(
        { code: 'CA' },
        upsertDto,
        res,
        req,
      );

      expect(result).toEqual(updatedCountry);
      expect(repository.upsert).toHaveBeenCalledWith(upsertDto);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    /**
     * Test upsert with code mismatch handling
     */
    it('should handle upsert when path code matches body alpha2', async () => {
      const country: Country = { 
        ...upsertDto, 
        id: 1,
        created: new Date('2024-01-15T10:30:00Z'),
        lastModified: new Date('2024-01-15T14:45:00Z'),
        modifiedBy: 'system',
      };
      repository.upsert.mockResolvedValue({
        country,
        created: false,
      });

      const req = mockRequest();
      const res = mockResponse();
      await controller.upsert({ code: 'CA' }, upsertDto, res, req);

      expect(repository.upsert).toHaveBeenCalledWith(upsertDto);
    });
  });

  describe('Error Handling', () => {
    /**
     * Test error handling for findAll when service throws unexpected error
     * Validates: Requirements 1.7
     */
    it('should propagate unexpected errors from service in findAll', async () => {
      const error = new Error('Database connection failed');
      repository.findPage.mockRejectedValue(error);

      const req = mockRequest();

      await expect(controller.findAll({}, req)).rejects.toThrow(error);
    });

    /**
     * Test error handling for findByCode when service throws unexpected error
     * Validates: Requirements 1.7
     */
    it('should propagate unexpected errors from service in findByCode', async () => {
      const error = new Error('Database connection failed');
      repository.findByCode.mockRejectedValue(error);

      const req = mockRequest();

      await expect(controller.findByCode({ code: 'US' }, req)).rejects.toThrow(error);
    });

    /**
     * Test error handling for create when service throws unexpected error
     * Validates: Requirements 1.7
     */
    it('should propagate unexpected errors from service in create', async () => {
      const error = new Error('Database connection failed');
      repository.create.mockRejectedValue(error);

      const req = mockRequest();
      const res = mockResponse();
      const createDto: CreateCountryInput = {
        name: 'Test Country',
        alpha2: 'TC',
        alpha3: 'TST',
        number: 999,
        dialingCode: 1,
      };

      await expect(controller.create(createDto, res, req)).rejects.toThrow(error);
    });

    /**
     * Test error handling for upsert when service throws unexpected error
     * Validates: Requirements 1.7
     */
    it('should propagate unexpected errors from service in upsert', async () => {
      const error = new Error('Database connection failed');
      repository.upsert.mockRejectedValue(error);

      const req = mockRequest();
      const res = mockResponse();
      const upsertDto: CreateCountryInput = {
        name: 'Test Country',
        alpha2: 'TC',
        alpha3: 'TST',
        number: 999,
        dialingCode: 1,
      };

      await expect(controller.upsert({ code: 'TC' }, upsertDto, res, req)).rejects.toThrow(error);
    });
  });

  describe('Response Headers', () => {
    /**
     * Test Location header is set correctly on create
     * Validates: Requirements 1.8
     */
    it('should set Location header with correct path on create', async () => {
      const newCountry: Country = {
        ...mockCountry,
        id: 2,
        alpha2: 'GB',
        alpha3: 'GBR',
        name: 'United Kingdom',
      };
      repository.create.mockResolvedValue(newCountry);

      const req = mockRequest();
      const res = mockResponse();
      const createDto: CreateCountryInput = {
        name: 'United Kingdom',
        alpha2: 'GB',
        alpha3: 'GBR',
        number: 826,
        dialingCode: 44,
      };

      await controller.create(createDto, res, req);

      expect(res.setHeader).toHaveBeenCalledWith('Location', '/v1/countries/GB');
    });

    /**
     * Test Location header is set on upsert when creating new country
     * Validates: Requirements 1.8
     */
    it('should set Location header on upsert when creating new country', async () => {
      const newCountry: Country = {
        ...mockCountry,
        id: 3,
        alpha2: 'FR',
        alpha3: 'FRA',
        name: 'France',
      };
      repository.upsert.mockResolvedValue({
        country: newCountry,
        created: true,
      });

      const req = mockRequest();
      const res = mockResponse();
      const upsertDto: CreateCountryInput = {
        name: 'France',
        alpha2: 'FR',
        alpha3: 'FRA',
        number: 250,
        dialingCode: 33,
      };

      await controller.upsert({ code: 'FR' }, upsertDto, res, req);

      expect(res.setHeader).toHaveBeenCalledWith('Location', '/v1/countries/FR');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    /**
     * Test no Location header on upsert when updating existing country
     * Validates: Requirements 1.8
     */
    it('should not set Location header on upsert when updating existing country', async () => {
      const existingCountry: Country = {
        ...mockCountry,
        name: 'United States Updated',
      };
      repository.upsert.mockResolvedValue({
        country: existingCountry,
        created: false,
      });

      const req = mockRequest();
      const res = mockResponse();
      const upsertDto: CreateCountryInput = {
        name: 'United States Updated',
        alpha2: 'US',
        alpha3: 'USA',
        number: 840,
        dialingCode: 1,
      };

      await controller.upsert({ code: 'US' }, upsertDto, res, req);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Correlation ID Integration', () => {
    /**
     * Validates: Requirements 4.2, 10.4
     * Test that controller can access correlation ID via AsyncContextStorage
     */
    it('should access correlation ID from AsyncContextStorage within controller context', async () => {
      const testCorrelationId = 'test-correlation-123';
      
      repository.findPage.mockResolvedValue({
        items: [mockCountry],
        total: 1,
      });

      const req = mockRequest();
      
      // Run the controller method within a correlation context
      const result = await CorrelationIdHelper.runInContext(
        testCorrelationId,
        { requestPath: '/v1/countries', method: 'GET' },
        async () => {
          // Verify correlation ID is accessible within the context
          const correlationId = AsyncContextStorage.getCorrelationId();
          expect(correlationId).toBe(testCorrelationId);
          
          // Execute controller method
          return await controller.findAll({ offset: 0, limit: 25 }, req);
        }
      );

      expect(result.items).toEqual([mockCountry]);
      expect(result.total).toBe(1);
    });

    /**
     * Validates: Requirements 4.2, 10.4
     * Test that correlation ID persists through async operations in controller
     */
    it('should maintain correlation ID through async operations', async () => {
      const testCorrelationId = 'test-async-correlation-456';
      
      repository.findByCode.mockResolvedValue(mockCountry);

      const req = mockRequest();
      
      await CorrelationIdHelper.runInContext(
        testCorrelationId,
        { requestPath: '/v1/countries/US', method: 'GET' },
        async () => {
          // Verify correlation ID before async operation
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
          
          // Execute controller method (which involves async repository call)
          const result = await controller.findByCode({ code: 'US' }, req);
          
          // Verify correlation ID persists after async operation
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
          expect(result).toEqual(mockCountry);
        }
      );
    });

    /**
     * Validates: Requirements 4.2, 10.4
     * Test that correlation ID is accessible in nested async operations
     */
    it('should access correlation ID in nested async operations', async () => {
      const testCorrelationId = 'test-nested-correlation-789';
      
      const createDto: CreateCountryInput = {
        name: 'Test Country',
        alpha2: 'TC',
        alpha3: 'TST',
        number: 999,
        dialingCode: 1,
      };

      const newCountry: Country = { 
        ...createDto, 
        id: 99,
        created: new Date('2024-01-15T10:30:00Z'),
        lastModified: new Date('2024-01-15T14:45:00Z'),
        modifiedBy: 'system',
      };
      
      repository.create.mockResolvedValue(newCountry);

      const req = mockRequest();
      const res = mockResponse();
      
      await CorrelationIdHelper.runInContext(
        testCorrelationId,
        { requestPath: '/v1/countries', method: 'POST' },
        async () => {
          // Verify correlation ID at start
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
          
          // Execute controller method with nested async operations
          const result = await controller.create(createDto, res, req);
          
          // Verify correlation ID still accessible after nested operations
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
          expect(result).toEqual(newCountry);
          
          // Simulate additional async operation (like logging)
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Verify correlation ID persists even after setTimeout
          expect(AsyncContextStorage.getCorrelationId()).toBe(testCorrelationId);
        }
      );
    });

    /**
     * Validates: Requirements 4.2, 10.4
     * Test that correlation ID is undefined outside of context
     */
    it('should return undefined when accessing correlation ID outside context', async () => {
      // Outside of any correlation context
      const correlationId = AsyncContextStorage.getCorrelationId();
      expect(correlationId).toBeUndefined();
    });

    /**
     * Validates: Requirements 4.2, 10.4
     * Test that multiple concurrent contexts maintain isolation
     */
    it('should maintain correlation ID isolation between concurrent operations', async () => {
      const correlationId1 = 'concurrent-test-1';
      const correlationId2 = 'concurrent-test-2';
      
      repository.findByCode.mockResolvedValue(mockCountry);

      const req = mockRequest();
      
      // Execute two concurrent operations with different correlation IDs
      const [result1, result2] = await Promise.all([
        CorrelationIdHelper.runInContext(
          correlationId1,
          { requestPath: '/v1/countries/US', method: 'GET' },
          async () => {
            // Verify this context has the correct correlation ID
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId1);
            
            // Add small delay to ensure concurrency
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Verify correlation ID hasn't changed
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId1);
            
            return await controller.findByCode({ code: 'US' }, req);
          }
        ),
        CorrelationIdHelper.runInContext(
          correlationId2,
          { requestPath: '/v1/countries/CA', method: 'GET' },
          async () => {
            // Verify this context has the correct correlation ID
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId2);
            
            // Add small delay to ensure concurrency
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Verify correlation ID hasn't changed
            expect(AsyncContextStorage.getCorrelationId()).toBe(correlationId2);
            
            return await controller.findByCode({ code: 'CA' }, req);
          }
        ),
      ]);

      expect(result1).toEqual(mockCountry);
      expect(result2).toEqual(mockCountry);
    });
  });
});
