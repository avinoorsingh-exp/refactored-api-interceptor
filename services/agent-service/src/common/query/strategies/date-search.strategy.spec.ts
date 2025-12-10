import { DateSearchStrategy } from './date-search.strategy.js';
import { SelectQueryBuilder, Brackets } from 'typeorm';
import { SearchableFieldConfig, SearchableFieldType } from '@exprealty/database';
import { ColumnResolverService } from '../column-resolver.service.js';

describe('DateSearchStrategy', () => {
  let strategy: DateSearchStrategy;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;
  let mockColumnResolver: jest.Mocked<ColumnResolverService>;

  beforeEach(() => {
    mockColumnResolver = {
      getColumnName: jest.fn().mockReturnValue('created_at'),
    } as unknown as jest.Mocked<ColumnResolverService>;

    strategy = new DateSearchStrategy(mockColumnResolver);

    // Mock entity metadata for column resolution
    const mockMetadata = {
      target: class MockEntity {},
    };

    mockQueryBuilder = {
      orWhere: jest.fn().mockReturnThis(),
      expressionMap: {
        mainAlias: {
          metadata: mockMetadata,
        },
      },
    } as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canHandle', () => {
    const config: SearchableFieldConfig = {
      field: 'createdAt',
      type: SearchableFieldType.DATE,
    };

    it('should return true for any search term', () => {
      expect(strategy.canHandle('2024', config)).toBe(true);
      expect(strategy.canHandle('2024-01', config)).toBe(true);
      expect(strategy.canHandle('2024-01-15', config)).toBe(true);
      expect(strategy.canHandle('random text', config)).toBe(true);
    });
  });

  describe('applySearch', () => {
    it('should apply year search for 4-digit year', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', '2024', 'param_0');

      // Should use Brackets for combined integer year + date extraction
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
      const call = mockQueryBuilder.orWhere.mock.calls[0][0];
      expect(call).toBeInstanceOf(Brackets);
    });

    it('should apply month range search for YYYY-MM format', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', '2024-01', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.createdAt BETWEEN :param_0_start AND :param_0_end',
        { param_0_start: '2024-01-01', param_0_end: '2024-01-31' },
      );
    });

    it('should apply month range search for February (non-leap year)', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', '2023-02', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.createdAt BETWEEN :param_0_start AND :param_0_end',
        { param_0_start: '2023-02-01', param_0_end: '2023-02-28' },
      );
    });

    it('should apply month range search for February (leap year)', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', '2024-02', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.createdAt BETWEEN :param_0_start AND :param_0_end',
        { param_0_start: '2024-02-01', param_0_end: '2024-02-29' },
      );
    });

    it('should apply exact date search for YYYY-MM-DD format', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', '2024-01-15', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.createdAt = :param_0_date',
        { param_0_date: '2024-01-15' },
      );
    });

    it('should apply text search fallback for non-date strings', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', 'january', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'CAST(entity.created_at AS TEXT) ILIKE :param_0',
        { param_0: '%january%' },
      );
    });

    it('should handle whitespace in search term', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'createdAt', '  2024  ', 'param_0');

      // Should trim and recognize as year
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
      const call = mockQueryBuilder.orWhere.mock.calls[0][0];
      expect(call).toBeInstanceOf(Brackets);
    });

    it('should use correct alias and field in query', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listDate', '2024-06-15', 'search_1');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'listing.listDate = :search_1_date',
        { search_1_date: '2024-06-15' },
      );
    });
  });
});
