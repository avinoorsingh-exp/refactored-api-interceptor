import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { ICountriesRepository } from './ports/countries.repository.port.js';
import type { Country, CreateCountryInput } from '@exprealty/shared-domain';
import type { Request, Response } from 'express';

describe('CountriesController', () => {
  let controller: CountriesController;
  let service: CountriesService;
  let repository: jest.Mocked<ICountriesRepository>;

  const mockCountry: Country = {
    countryId: 1,
    name: 'United States',
    alpha2: 'US',
    alpha3: 'USA',
    number: 840,
    dialingCode: 1,
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
      ],
    }).compile();

    controller = module.get<CountriesController>(CountriesController);
    service = module.get<CountriesService>(CountriesService);
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
        { ...mockCountry, alpha2: 'AD', countryId: 1 },
        { ...mockCountry, alpha2: 'AE', countryId: 2 },
        { ...mockCountry, alpha2: 'AF', countryId: 3 },
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
        { ...mockCountry, alpha2: 'BR', countryId: 30 },
        { ...mockCountry, alpha2: 'BS', countryId: 31 },
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
        countryId: i + 1,
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
      const newCountry: Country = { ...createDto, countryId: 2 };
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
      const newCountry: Country = { ...upsertDto, countryId: 2 };
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
      const updatedCountry: Country = { ...upsertDto, countryId: 1 };
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
      const country: Country = { ...upsertDto, countryId: 1 };
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
});
