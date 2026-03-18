import { CountriesService } from './countries.service.js';
import type { ICountriesRepository } from './ports/countries.repository.port.js';
import type { Country, CreateCountryInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for CountriesService
 * Tests create(), findByCode(), upsert(), findPage() with mocked repository
 * Validates: Requirements 2.6, 2.7
 */
describe('CountriesService', () => {
  let service: CountriesService;
  let repository: jest.Mocked<ICountriesRepository>;
  let logger: jest.Mocked<LoggerService>;

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

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByCode: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    } as jest.Mocked<ICountriesRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    service = new CountriesService(repository, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllCountries', () => {
    it('should return all countries from repository', async () => {
      const countries: Country[] = [mockCountry];
      repository.findAll.mockResolvedValue(countries);

      const result = await service.findAllCountries();

      expect(result).toEqual(countries);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    const createDto: CreateCountryInput = {
      name: 'Canada',
      alpha2: 'CA',
      alpha3: 'CAN',
      number: 124,
      dialingCode: 1,
    };

    /**
     * Test successful country creation
     * Validates: Requirements 2.6
     */
    it('should create a new country successfully', async () => {
      const newCountry: Country = {
        ...mockCountry,
        id: 2,
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
      };

      repository.create.mockResolvedValue(newCountry);

      const result = await service.create(createDto);

      expect(result).toEqual(newCountry);
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    /**
     * Test error propagation from repository
     */
    it('should propagate errors from repository', async () => {
      const error = new Error('Database connection failed');
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(error);
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findByCode', () => {
    /**
     * Test successful retrieval by code
     * Validates: Requirements 2.7
     */
    it('should return country when found by code', async () => {
      repository.findByCode.mockResolvedValue(mockCountry);

      const result = await service.findByCode('US');

      expect(result).toEqual(mockCountry);
      expect(repository.findByCode).toHaveBeenCalledWith('US');
    });

    /**
     * Test not found scenario - returns null
     * Validates: Requirements 2.7
     */
    it('should return null when country not found by code', async () => {
      repository.findByCode.mockResolvedValue(null);

      const result = await service.findByCode('XX');

      expect(result).toBeNull();
      expect(repository.findByCode).toHaveBeenCalledWith('XX');
    });

    /**
     * Test error propagation
     */
    it('should propagate errors from repository', async () => {
      const error = new Error('Database error');
      repository.findByCode.mockRejectedValue(error);

      await expect(service.findByCode('US')).rejects.toThrow(error);
    });
  });

  describe('upsert', () => {
    const upsertDto: CreateCountryInput = {
      name: 'Canada',
      alpha2: 'CA',
      alpha3: 'CAN',
      number: 124,
      dialingCode: 1,
    };

    /**
     * Test upsert creates new country
     * Validates: Requirements 2.6
     */
    it('should create new country when it does not exist', async () => {
      const newCountry: Country = {
        ...mockCountry,
        id: 2,
        name: 'Canada',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
      };

      repository.upsert.mockResolvedValue({
        country: newCountry,
        created: true,
      });

      const result = await service.upsert(upsertDto);

      expect(result.country).toEqual(newCountry);
      expect(result.created).toBe(true);
      expect(repository.upsert).toHaveBeenCalledWith(upsertDto);
    });

    /**
     * Test upsert updates existing country
     * Validates: Requirements 2.6
     */
    it('should update existing country when it exists', async () => {
      const updatedCountry: Country = {
        ...mockCountry,
        name: 'Canada Updated',
        alpha2: 'CA',
        alpha3: 'CAN',
        number: 124,
      };

      repository.upsert.mockResolvedValue({
        country: updatedCountry,
        created: false,
      });

      const result = await service.upsert(upsertDto);

      expect(result.country).toEqual(updatedCountry);
      expect(result.created).toBe(false);
      expect(repository.upsert).toHaveBeenCalledWith(upsertDto);
    });

    /**
     * Test error propagation
     */
    it('should propagate errors from repository', async () => {
      const error = new Error('Database error');
      repository.upsert.mockRejectedValue(error);

      await expect(service.upsert(upsertDto)).rejects.toThrow(error);
    });
  });

  describe('findPage', () => {
    /**
     * Test paginated retrieval
     * Validates: Requirements 2.6
     */
    it('should return paginated countries from repository', async () => {
      const mockCountries = [
        { ...mockCountry, alpha2: 'AD', name: 'Andorra' },
        { ...mockCountry, alpha2: 'AE', name: 'United Arab Emirates' },
      ];

      repository.findPage.mockResolvedValue({
        items: mockCountries,
        total: 249,
      });

      const result = await service.findPage({ offset: 0, limit: 25 });

      expect(result.countries).toEqual(mockCountries);
      expect(result.total).toBe(249);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 });
    });

    /**
     * Test pagination with offset
     */
    it('should handle pagination offset correctly', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockCountry],
        total: 249,
      });

      const result = await service.findPage({ offset: 25, limit: 25 });

      expect(result.countries).toHaveLength(1);
      expect(result.total).toBe(249);
      expect(repository.findPage).toHaveBeenCalledWith({ offset: 25, limit: 25 });
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

      expect(result.countries).toEqual([]);
      expect(result.total).toBe(0);
    });

    /**
     * Test with filter, sort, and search
     */
    it('should pass filter, sort, and search to repository', async () => {
      repository.findPage.mockResolvedValue({
        items: [mockCountry],
        total: 1,
      });

      const query = {
        offset: 0,
        limit: 25,
        filter: 'dialingCode:eq:1',
        sort: 'name:ASC',
        search: 'United',
      };

      await service.findPage(query);

      expect(repository.findPage).toHaveBeenCalledWith(query);
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
