import { BooleanSearchStrategy } from './boolean-search.strategy.js';
import { SelectQueryBuilder } from 'typeorm';
import { SearchableFieldConfig, SearchableFieldType } from '@exprealty/database';

describe('BooleanSearchStrategy', () => {
  let strategy: BooleanSearchStrategy;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;

  beforeEach(() => {
    strategy = new BooleanSearchStrategy();
    mockQueryBuilder = {
      orWhere: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canHandle', () => {
    const config: SearchableFieldConfig = {
      field: 'isActive',
      type: SearchableFieldType.BOOLEAN,
    };

    it('should return true for truthy string values', () => {
      expect(strategy.canHandle('true', config)).toBe(true);
      expect(strategy.canHandle('yes', config)).toBe(true);
      expect(strategy.canHandle('1', config)).toBe(true);
      expect(strategy.canHandle('y', config)).toBe(true);
      expect(strategy.canHandle('t', config)).toBe(true);
    });

    it('should return true for falsy string values', () => {
      expect(strategy.canHandle('false', config)).toBe(true);
      expect(strategy.canHandle('no', config)).toBe(true);
      expect(strategy.canHandle('0', config)).toBe(true);
      expect(strategy.canHandle('n', config)).toBe(true);
      expect(strategy.canHandle('f', config)).toBe(true);
    });

    it('should return true for case-insensitive values', () => {
      expect(strategy.canHandle('TRUE', config)).toBe(true);
      expect(strategy.canHandle('True', config)).toBe(true);
      expect(strategy.canHandle('FALSE', config)).toBe(true);
      expect(strategy.canHandle('False', config)).toBe(true);
      expect(strategy.canHandle('YES', config)).toBe(true);
      expect(strategy.canHandle('NO', config)).toBe(true);
    });

    it('should return false for non-boolean values', () => {
      expect(strategy.canHandle('maybe', config)).toBe(false);
      expect(strategy.canHandle('2', config)).toBe(false);
      expect(strategy.canHandle('', config)).toBe(false);
      expect(strategy.canHandle('random', config)).toBe(false);
    });

    it('should handle whitespace in values', () => {
      expect(strategy.canHandle('  true  ', config)).toBe(true);
      expect(strategy.canHandle('  false  ', config)).toBe(true);
    });
  });

  describe('applySearch', () => {
    it('should apply true condition for truthy values', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'true', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: true },
      );
    });

    it('should apply true condition for "yes"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'yes', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: true },
      );
    });

    it('should apply true condition for "1"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', '1', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: true },
      );
    });

    it('should apply true condition for "y"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'y', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: true },
      );
    });

    it('should apply true condition for "t"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 't', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: true },
      );
    });

    it('should apply false condition for falsy values', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'false', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: false },
      );
    });

    it('should apply false condition for "no"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'no', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: false },
      );
    });

    it('should apply false condition for "0"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', '0', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: false },
      );
    });

    it('should apply false condition for "n"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'n', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: false },
      );
    });

    it('should apply false condition for "f"', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'f', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: false },
      );
    });

    it('should not apply any condition for non-boolean values', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'maybe', 'param_0');

      expect(mockQueryBuilder.orWhere).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive values', () => {
      strategy.applySearch(mockQueryBuilder, 'entity', 'isActive', 'TRUE', 'param_0');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'entity.isActive = :param_0',
        { param_0: true },
      );
    });

    it('should use correct alias and field in query', () => {
      strategy.applySearch(mockQueryBuilder, 'listing', 'hasPool', 'yes', 'search_1');

      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'listing.hasPool = :search_1',
        { search_1: true },
      );
    });
  });
});
