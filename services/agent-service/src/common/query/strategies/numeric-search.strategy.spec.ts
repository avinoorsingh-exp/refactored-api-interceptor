import { NumericSearchStrategy } from './numeric-search.strategy.js';
import { SelectQueryBuilder, Brackets } from 'typeorm';
import { SearchableFieldConfig, SearchableFieldType } from '@exprealty/database';
import { ColumnResolverService } from '../column-resolver.service.js';

describe('NumericSearchStrategy', () => {
  let strategy: NumericSearchStrategy;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;
  let mockColumnResolver: jest.Mocked<ColumnResolverService>;

  beforeEach(() => {
    mockColumnResolver = {
      getColumnName: jest.fn().mockReturnValue('list_price'),
    } as unknown as jest.Mocked<ColumnResolverService>;

    strategy = new NumericSearchStrategy(mockColumnResolver);

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
      field: 'price',
      type: SearchableFieldType.NUMERIC,
    };

    it('should return true for numeric values', () => {
      expect(strategy.canHandle('100', config)).toBe(true);
      expect(strategy.canHandle('99.99', config)).toBe(true);
      expect(strategy.canHandle('0', config)).toBe(true);
    });

    it('should return true for range values', () => {
      expect(strategy.canHandle('100-500', config)).toBe(true);
      expect(strategy.canHandle('10.5-20.5', config)).toBe(true);
      expect(strategy.canHandle('0-1000', config)).toBe(true);
    });

    it('should return true for currency formatted values', () => {
      expect(strategy.canHandle('$100', config)).toBe(true);
      expect(strategy.canHandle('1,000', config)).toBe(true);
      expect(strategy.canHandle('$1,000.00', config)).toBe(true);
    });

    it('should return true for shorthand values (k, m)', () => {
      expect(strategy.canHandle('100k', config)).toBe(true);
      expect(strategy.canHandle('1.5m', config)).toBe(true);
      expect(strategy.canHandle('500K', config)).toBe(true);
    });

    it('should return true for non-empty strings (fallback text search)', () => {
      expect(strategy.canHandle('abc', config)).toBe(true);
      expect(strategy.canHandle('test123', config)).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(strategy.canHandle('', config)).toBe(false);
      expect(strategy.canHandle('   ', config)).toBe(false);
    });
  });

  describe('applySearch', () => {
    it('should apply range search for range pattern', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', '500-1000', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'listing.list_price BETWEEN :param_0_min AND :param_0_max',
        { param_0_min: 500, param_0_max: 1000 },
      );
    });

    it('should apply range search for decimal range', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', '10.5-20.5', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'listing.list_price BETWEEN :param_0_min AND :param_0_max',
        { param_0_min: 10.5, param_0_max: 20.5 },
      );
    });

    it('should apply exact match and text search for numeric value', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', '500', 'param_0');

      // Should use Brackets for combined exact + text search
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
      const call = mockQueryBuilder.orWhere.mock.calls[0][0];
      expect(call).toBeInstanceOf(Brackets);
    });

    it('should apply text search for non-numeric value', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', 'abc', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'CAST(listing.list_price AS TEXT) ILIKE :param_0',
        { param_0: '%abc%' },
      );
    });

    it('should handle currency formatted values', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', '$1,000', 'param_0');

      // Should parse $1,000 as 1000
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
    });

    it('should handle shorthand k notation', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', '100k', 'param_0');

      // Should parse 100k as 100000
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
    });

    it('should handle shorthand m notation', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'listPrice', '1.5m', 'param_0');

      // Should parse 1.5m as 1500000
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
    });
  });
});
