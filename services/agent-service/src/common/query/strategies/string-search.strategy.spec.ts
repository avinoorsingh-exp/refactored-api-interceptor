import { StringSearchStrategy } from './string-search.strategy.js';
import { SelectQueryBuilder } from 'typeorm';
import { SearchableFieldConfig, SearchableFieldType } from '@exprealty/database';

describe('StringSearchStrategy', () => {
  let strategy: StringSearchStrategy;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;

  beforeEach(() => {
    strategy = new StringSearchStrategy();
    mockQueryBuilder = {
      orWhere: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canHandle', () => {
    it('should return true for any search term', () => {
      const config: SearchableFieldConfig = {
        field: 'name',
        type: SearchableFieldType.STRING,
      };

      expect(strategy.canHandle('test', config)).toBe(true);
      expect(strategy.canHandle('', config)).toBe(true);
      expect(strategy.canHandle('123', config)).toBe(true);
      expect(strategy.canHandle('special!@#$', config)).toBe(true);
    });

    it('should return true for text field type', () => {
      const config: SearchableFieldConfig = {
        field: 'description',
        type: SearchableFieldType.TEXT,
      };

      expect(strategy.canHandle('any value', config)).toBe(true);
    });
  });

  describe('applySearch', () => {
    it('should apply partial ILIKE search by default', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'name', 'test', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :param_0',
        { param_0: '%test%' },
      );
    });

    it('should handle empty search term', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'name', '', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :param_0',
        { param_0: '%%' },
      );
    });

    it('should handle search term with special characters', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'name', 'test%value', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :param_0',
        { param_0: '%test%value%' },
      );
    });

    it('should use correct alias and field in query', () => {
      strategy.applySearch(mockQueryBuilder, 'state', 'code', 'CA', 'search_1');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'state.code ILIKE :search_1',
        { search_1: '%CA%' },
      );
    });

    it('should handle whitespace in search term', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'name', 'hello world', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :param_0',
        { param_0: '%hello world%' },
      );
    });
  });
});
