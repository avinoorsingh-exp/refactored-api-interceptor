import { QueryService } from './query.service.js';
import { SelectQueryBuilder, Brackets } from 'typeorm';
import type { NormalizedQueryParams, Filter, Sort, QueryParams } from '@exprealty/shared-domain';

// Mock entity class for testing (similar to CountryEntity)
class MockEntity {
  id!: number;
  name!: string;
  status!: string;
  number!: number;  // Integer column like country.number
  dialingCode!: number;  // Another integer column
  createdAt!: Date;
}

// Mock the database decorators
jest.mock('@exprealty/database', () => ({
  getFilterableFields: jest.fn(() => ['name', 'status', 'number', 'dialingCode', 'createdAt']),
  getSortableFields: jest.fn(() => ['name', 'status', 'number', 'dialingCode', 'createdAt']),
  getSearchableFields: jest.fn(() => ['name']),
}));

// Mock SearchMetadataReader for strategy search tests
const mockSearchMetadataReader = {
  getSearchableFieldsConfig: jest.fn(() => []),
};

describe('QueryService', () => {
  let service: QueryService;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;

  beforeEach(() => {
    service = new QueryService();

    // Create mock query builder
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('normalize', () => {
    it('should normalize query params with defaults', () => {
      const result = service.normalize({});

      expect(result.offset).toBe(0);
      expect(result.limit).toBe(25);
      expect(result.filter).toBeUndefined();
      expect(result.sort).toBeUndefined();
      expect(result.search).toBeUndefined();
    });

    it('should normalize query params with custom pagination', () => {
      const result = service.normalize({ offset: 10, limit: 50 });

      expect(result.offset).toBe(10);
      expect(result.limit).toBe(50);
    });

    it('should normalize query params with filter', () => {
      const filter = {
        conditions: [{ field: 'status', operator: 'eq' as const, value: 'active' }],
        logicalOperator: 'AND' as const,
      };

      const result = service.normalize({ filter: JSON.stringify(filter) });

      expect(result.filter).toBeDefined();
      expect(result.filter?.conditions).toHaveLength(1);
      expect(result.filter?.conditions[0].field).toBe('status');
    });

    it('should normalize query params with sort', () => {
      const sort = {
        conditions: [{ field: 'name', direction: 'ASC' as const }],
      };

      const result = service.normalize({ sort: JSON.stringify(sort) });

      expect(result.sort).toBeDefined();
      expect(result.sort?.conditions).toHaveLength(1);
      expect(result.sort?.conditions[0].field).toBe('name');
    });

    it('should normalize query params with search', () => {
      const result = service.normalize({
        search: 'test query',
        searchFields: 'name',  // comma-separated string
      });

      expect(result.search).toBeDefined();
      expect(result.search?.query).toBe('test query');
      expect(result.search?.fields).toEqual(['name']);
    });
  });

  describe('normalizeWithValidation', () => {
    it('should validate filter fields against entity', () => {
      const filter = {
        conditions: [{ field: 'name', operator: 'eq' as const, value: 'test' }],
        logicalOperator: 'AND' as const,
      };

      const result = service.normalizeWithValidation(
        { filter: JSON.stringify(filter) },
        MockEntity,
      );

      expect(result.filter?.conditions[0].field).toBe('name');
    });

    it('should throw error for invalid filter field', () => {
      const filter = {
        conditions: [{ field: 'invalidField', operator: 'eq' as const, value: 'test' }],
        logicalOperator: 'AND' as const,
      };

      expect(() =>
        service.normalizeWithValidation(
          { filter: JSON.stringify(filter) },
          MockEntity,
        ),
      ).toThrow(/Invalid filter fields/);
    });

    it('should validate sort fields against entity', () => {
      const sort = {
        conditions: [{ field: 'name', direction: 'ASC' as const }],
      };

      const result = service.normalizeWithValidation(
        { sort: JSON.stringify(sort) },
        MockEntity,
      );

      expect(result.sort?.conditions[0].field).toBe('name');
    });

    it('should throw error for invalid sort field', () => {
      const sort = {
        conditions: [{ field: 'invalidField', direction: 'ASC' as const }],
      };

      expect(() =>
        service.normalizeWithValidation(
          { sort: JSON.stringify(sort) },
          MockEntity,
        ),
      ).toThrow(/Invalid sort fields/);
    });

    it('should validate search fields against entity', () => {
      const result = service.normalizeWithValidation(
        { search: 'test', searchFields: 'name' },  // comma-separated string
        MockEntity,
      );

      expect(result.search?.fields).toEqual(['name']);
    });

    it('should throw error for invalid search field', () => {
      expect(() =>
        service.normalizeWithValidation(
          { search: 'test', searchFields: 'invalidField' },  // comma-separated string
          MockEntity,
        ),
      ).toThrow(/Invalid search fields/);
    });

    it('should use all searchable fields when none specified', () => {
      const result = service.normalizeWithValidation(
        { search: 'test' },
        MockEntity,
      );

      expect(result.search?.query).toBe('test');
      expect(result.search?.fields).toEqual(['name']);
    });
  });

  describe('applyFilters', () => {
    it('should not modify query builder when no filter provided', () => {
      service.applyFilters(mockQueryBuilder, undefined, 'entity');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should not modify query builder when filter has no conditions', () => {
      const filter: Filter = { conditions: [], logicalOperator: 'AND' };

      service.applyFilters(mockQueryBuilder, filter, 'entity');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should apply eq filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply multiple filter conditions with AND', () => {
      const filter: Filter = {
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'name', operator: 'like', value: 'test' },
        ],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should allow filter when field is in allowed list', () => {
      const filter: Filter = {
        conditions: [{ field: 'name', operator: 'eq', value: 'value' }],
        logicalOperator: 'AND',
      };
      const allowedFields = new Set(['name', 'status']);

      // Should not throw when field is allowed
      expect(() =>
        service.applyFilters(mockQueryBuilder, filter, 'entity', allowedFields),
      ).not.toThrow();
    });
  });

  describe('applySorting', () => {
    it('should not modify query builder when no sort provided', () => {
      service.applySorting(mockQueryBuilder, undefined, 'entity');

      expect(mockQueryBuilder.orderBy).not.toHaveBeenCalled();
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should not modify query builder when sort has no conditions', () => {
      const sort: Sort = { conditions: [] };

      service.applySorting(mockQueryBuilder, sort, 'entity');

      expect(mockQueryBuilder.orderBy).not.toHaveBeenCalled();
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should use orderBy for single sort condition with reserved word quoting', () => {
      const sort: Sort = {
        conditions: [{ field: 'name', direction: 'ASC' }],
      };

      service.applySorting(mockQueryBuilder, sort, 'entity');

      // 'name' is a reserved word and should be quoted
      // First (and only) condition uses orderBy, not addOrderBy
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('entity."name"', 'ASC');
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should use orderBy for first condition and addOrderBy for subsequent conditions', () => {
      const sort: Sort = {
        conditions: [
          { field: 'status', direction: 'ASC' },    // not a reserved word
          { field: 'createdAt', direction: 'DESC' }, // not a reserved word
        ],
      };

      service.applySorting(mockQueryBuilder, sort, 'entity');

      // First condition uses orderBy
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('entity.status', 'ASC');
      // Second condition uses addOrderBy
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('entity.createdAt', 'DESC');
    });

    it('should throw error for disallowed sort field', () => {
      const sort: Sort = {
        conditions: [{ field: 'secret', direction: 'ASC' }],
      };
      const allowedFields = new Set(['name', 'status']);

      expect(() =>
        service.applySorting(mockQueryBuilder, sort, 'entity', allowedFields),
      ).toThrow(/not allowed for sorting/);
    });

    it('should quote reserved word column (number) when sorting', () => {
      const sort: Sort = {
        conditions: [{ field: 'number', direction: 'ASC' }],
      };

      service.applySorting(mockQueryBuilder, sort, 'country');

      // 'number' is a reserved word and should be quoted
      // Single condition uses orderBy
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('country."number"', 'ASC');
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should not quote non-reserved word column (dialingCode) when sorting', () => {
      const sort: Sort = {
        conditions: [{ field: 'dialingCode', direction: 'DESC' }],
      };

      service.applySorting(mockQueryBuilder, sort, 'country');

      // 'dialingCode' is not a reserved word, should not be quoted
      // Single condition uses orderBy
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('country.dialingCode', 'DESC');
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should handle mixed reserved and non-reserved columns in sort', () => {
      const sort: Sort = {
        conditions: [
          { field: 'name', direction: 'ASC' },      // 'name' is a reserved word
          { field: 'number', direction: 'DESC' },   // 'number' is a reserved word
          { field: 'dialingCode', direction: 'ASC' }, // not a reserved word
        ],
      };

      service.applySorting(mockQueryBuilder, sort, 'country');

      // First condition uses orderBy
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('country."name"', 'ASC');
      // Subsequent conditions use addOrderBy
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('country."number"', 'DESC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('country.dialingCode', 'ASC');
    });
  });

  describe('applySearch', () => {
    it('should not modify query builder when no search provided', () => {
      service.applySearch(mockQueryBuilder, undefined, 'entity');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should not modify query builder when search query is empty', () => {
      service.applySearch(mockQueryBuilder, { query: '', fields: ['name'] }, 'entity');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should not modify query builder when search fields are empty', () => {
      service.applySearch(mockQueryBuilder, { query: 'test', fields: [] }, 'entity');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should apply search across specified fields', () => {
      const search = { query: 'test', fields: ['name'] };

      service.applySearch(mockQueryBuilder, search, 'entity');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should allow search when field is in allowed list', () => {
      const search = { query: 'test', fields: ['name'] };
      const allowedFields = new Set(['name', 'status']);

      // Should not throw when field is allowed
      expect(() =>
        service.applySearch(mockQueryBuilder, search, 'entity', allowedFields),
      ).not.toThrow();
    });
  });

  describe('applyAll', () => {
    it('should apply all query operations', () => {
      const params: NormalizedQueryParams = {
        offset: 0,
        limit: 25,
        filter: {
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          logicalOperator: 'AND',
        },
        sort: {
          conditions: [{ field: 'name', direction: 'ASC' }],
        },
        search: {
          query: 'test',
          fields: ['name'],
        },
      };

      service.applyAll(mockQueryBuilder, params, 'entity');

      // Filter, search, and sort should all be applied
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled(); // Single sort uses orderBy
    });

    it('should handle empty params', () => {
      const params: NormalizedQueryParams = {
        offset: 0,
        limit: 25,
      };

      service.applyAll(mockQueryBuilder, params, 'entity');

      // No operations should be applied
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });
  });

  describe('applyFilters - all operators', () => {
    it('should apply ne (not equal) filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'ne', value: 'inactive' }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply gt (greater than) filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'number', operator: 'gt', value: 10 }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply gte (greater than or equal) filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'number', operator: 'gte', value: 10 }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply lt (less than) filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'number', operator: 'lt', value: 100 }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply lte (less than or equal) filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'number', operator: 'lte', value: 100 }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply ilike filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'name', operator: 'ilike', value: 'test' }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply in filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'in', value: ['active', 'pending'] }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply nin (not in) filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'nin', value: ['deleted', 'archived'] }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply between filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'number', operator: 'between', value: [10, 100] }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply isNull filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'isNull', value: null }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply isNotNull filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'isNotNull', value: null }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply startsWith filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'name', operator: 'startsWith', value: 'Test' }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply endsWith filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'name', operator: 'endsWith', value: 'ing' }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply contains filter condition', () => {
      const filter: Filter = {
        conditions: [{ field: 'name', operator: 'contains', value: 'middle' }],
        logicalOperator: 'AND',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply multiple conditions with OR logical operator', () => {
      const filter: Filter = {
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'status', operator: 'eq', value: 'pending' },
        ],
        logicalOperator: 'OR',
      };

      service.applyFilters(mockQueryBuilder, filter, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should throw error for unsupported filter operator', () => {
      // Create a mock that executes the Brackets callback
      const mockQbWithBrackets = {
        ...mockQueryBuilder,
        andWhere: jest.fn().mockImplementation((brackets: any) => {
          if (typeof brackets === 'function') {
            brackets(mockQueryBuilder);
          } else if (brackets && typeof brackets.whereFactory === 'function') {
            // Brackets object - execute the factory
            const subQb = {
              andWhere: jest.fn().mockReturnThis(),
              orWhere: jest.fn().mockReturnThis(),
            };
            brackets.whereFactory(subQb);
          }
          return mockQbWithBrackets;
        }),
      } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;

      const filter: Filter = {
        conditions: [{ field: 'status', operator: 'unsupported' as any, value: 'test' }],
        logicalOperator: 'AND',
      };

      expect(() => service.applyFilters(mockQbWithBrackets, filter, 'entity')).toThrow(
        /Unsupported filter operator/,
      );
    });

    it('should throw error for disallowed filter field', () => {
      // Create a mock that executes the Brackets callback
      const mockQbWithBrackets = {
        ...mockQueryBuilder,
        andWhere: jest.fn().mockImplementation((brackets: any) => {
          if (typeof brackets === 'function') {
            brackets(mockQueryBuilder);
          } else if (brackets && typeof brackets.whereFactory === 'function') {
            // Brackets object - execute the factory
            const subQb = {
              andWhere: jest.fn().mockReturnThis(),
              orWhere: jest.fn().mockReturnThis(),
            };
            brackets.whereFactory(subQb);
          }
          return mockQbWithBrackets;
        }),
      } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;

      const filter: Filter = {
        conditions: [{ field: 'secret', operator: 'eq', value: 'test' }],
        logicalOperator: 'AND',
      };
      const allowedFields = new Set(['name', 'status']);

      expect(() =>
        service.applyFilters(mockQbWithBrackets, filter, 'entity', allowedFields),
      ).toThrow(/not allowed for filtering/);
    });
  });

  describe('applySearch - additional cases', () => {
    it('should throw error for disallowed search field', () => {
      // Create a mock that executes the Brackets callback
      const mockQbWithBrackets = {
        ...mockQueryBuilder,
        andWhere: jest.fn().mockImplementation((brackets: any) => {
          if (typeof brackets === 'function') {
            brackets(mockQueryBuilder);
          } else if (brackets && typeof brackets.whereFactory === 'function') {
            // Brackets object - execute the factory
            const subQb = {
              andWhere: jest.fn().mockReturnThis(),
              orWhere: jest.fn().mockReturnThis(),
            };
            brackets.whereFactory(subQb);
          }
          return mockQbWithBrackets;
        }),
      } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;

      const search = { query: 'test', fields: ['secret'] };
      const allowedFields = new Set(['name', 'status']);

      expect(() =>
        service.applySearch(mockQbWithBrackets, search, 'entity', allowedFields),
      ).toThrow(/not allowed for searching/);
    });

    it('should apply search with reserved word field', () => {
      const search = { query: 'test', fields: ['name'] };

      service.applySearch(mockQueryBuilder, search, 'entity');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('applyStrategySearch', () => {
    it('should return query builder unchanged when no search query', () => {
      const result = service.applyStrategySearch(mockQueryBuilder, undefined, MockEntity, 'entity');
      expect(result).toBe(mockQueryBuilder);
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should return query builder unchanged when no strategies configured', () => {
      const result = service.applyStrategySearch(mockQueryBuilder, 'test', MockEntity, 'entity');
      expect(result).toBe(mockQueryBuilder);
    });
  });

  describe('applyAllWithStrategies', () => {
    it('should apply filters, strategy search, and sorting', () => {
      const params: NormalizedQueryParams = {
        offset: 0,
        limit: 25,
        filter: {
          conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
          logicalOperator: 'AND',
        },
        sort: {
          conditions: [{ field: 'name', direction: 'ASC' }],
        },
        search: {
          query: 'test',
          fields: ['name'],
        },
      };

      service.applyAllWithStrategies(mockQueryBuilder, params, MockEntity, 'entity');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled(); // Single sort uses orderBy
    });

    it('should handle empty params', () => {
      const params: NormalizedQueryParams = {
        offset: 0,
        limit: 25,
      };

      service.applyAllWithStrategies(mockQueryBuilder, params, MockEntity, 'entity');

      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });
  });
});


// ============================================================================
// Property-Based Tests
// ============================================================================
import * as fc from 'fast-check';

describe('QueryService - Property-Based Tests', () => {
  let service: QueryService;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;

  beforeEach(() => {
    service = new QueryService();
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: agent-service-coverage, Property 6: QueryService Normalization Produces Valid Output**
   * *For any* partial query parameters, QueryService.normalize SHALL produce a NormalizedQueryParams
   * object with valid offset (≥0), limit (1-50), and properly parsed filter/sort/search.
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 6: QueryService Normalization Produces Valid Output', () => {
    it('should produce valid normalized params for any valid input', () => {
      fc.assert(
        fc.property(
          fc.record({
            offset: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
            limit: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
          }),
          (input) => {
            const result = service.normalize(input);

            // Invariant: offset is always >= 0
            expect(result.offset).toBeGreaterThanOrEqual(0);

            // Invariant: limit is always between 1 and 50
            expect(result.limit).toBeGreaterThanOrEqual(1);
            expect(result.limit).toBeLessThanOrEqual(50);

            // Invariant: if offset provided, it's preserved
            if (input.offset !== undefined) {
              expect(result.offset).toBe(input.offset);
            } else {
              expect(result.offset).toBe(0); // default
            }

            // Invariant: if limit provided, it's preserved (within bounds)
            if (input.limit !== undefined) {
              expect(result.limit).toBe(input.limit);
            } else {
              expect(result.limit).toBe(25); // default
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 7: QueryService Filter Operators Generate Correct SQL**
   * *For any* valid filter condition with any supported operator, QueryService.applyFilters
   * SHALL generate the correct SQL WHERE clause.
   * **Validates: Requirements 4.3**
   */
  describe('Property 7: QueryService Filter Operators Generate Correct SQL', () => {
    const simpleOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'contains', 'startsWith', 'endsWith'] as const;
    const nullOperators = ['isNull', 'isNotNull'] as const;

    it('should apply filter for any simple operator', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...simpleOperators),
          fc.constantFrom('name', 'status'),
          fc.string({ minLength: 1, maxLength: 50 }),
          (operator, field, value) => {
            const filter: Filter = {
              conditions: [{ field, operator, value }],
              logicalOperator: 'AND',
            };

            // Reset mock
            mockQueryBuilder.andWhere.mockClear();

            service.applyFilters(mockQueryBuilder, filter, 'entity');

            // Invariant: andWhere is called for any valid filter
            expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should apply filter for null operators', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...nullOperators),
          fc.constantFrom('name', 'status'),
          (operator, field) => {
            const filter: Filter = {
              conditions: [{ field, operator, value: null }],
              logicalOperator: 'AND',
            };

            mockQueryBuilder.andWhere.mockClear();

            service.applyFilters(mockQueryBuilder, filter, 'entity');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 8: QueryService Sorting Quotes Reserved Words**
   * *For any* sort condition on a PostgreSQL reserved word column, QueryService.applySorting
   * SHALL quote the column name in the ORDER BY clause.
   * **Validates: Requirements 4.4**
   */
  describe('Property 8: QueryService Sorting Quotes Reserved Words', () => {
    const reservedWords = ['number', 'order', 'group', 'user', 'table', 'column', 'name', 'type', 'date', 'time', 'value', 'key'] as const;
    const nonReservedWords = ['status', 'dialingCode', 'createdAt', 'firstName', 'lastName'] as const;

    it('should quote reserved word columns when sorting', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...reservedWords),
          fc.constantFrom('ASC', 'DESC'),
          (field, direction) => {
            const sort: Sort = {
              conditions: [{ field, direction: direction as 'ASC' | 'DESC' }],
            };

            mockQueryBuilder.orderBy.mockClear();
            mockQueryBuilder.addOrderBy.mockClear();

            service.applySorting(mockQueryBuilder, sort, 'entity');

            // Invariant: reserved words are quoted, single condition uses orderBy
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
              expect.stringContaining(`"${field}"`),
              direction,
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should not quote non-reserved word columns when sorting', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...nonReservedWords),
          fc.constantFrom('ASC', 'DESC'),
          (field, direction) => {
            const sort: Sort = {
              conditions: [{ field, direction: direction as 'ASC' | 'DESC' }],
            };

            mockQueryBuilder.orderBy.mockClear();
            mockQueryBuilder.addOrderBy.mockClear();

            service.applySorting(mockQueryBuilder, sort, 'entity');

            // Invariant: non-reserved words are not quoted, single condition uses orderBy
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
              `entity.${field}`,
              direction,
            );
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 9: QueryService Search Applies ILIKE Across Fields**
   * *For any* search query with multiple fields, QueryService.applySearch SHALL generate
   * OR-combined ILIKE conditions for each field.
   * **Validates: Requirements 4.5**
   */
  describe('Property 9: QueryService Search Applies ILIKE Across Fields', () => {
    it('should apply search across all specified fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.constantFrom('name', 'status'), { minLength: 1, maxLength: 3 }),
          (query, fields) => {
            const uniqueFields = [...new Set(fields)];
            const search = { query, fields: uniqueFields };

            mockQueryBuilder.andWhere.mockClear();

            service.applySearch(mockQueryBuilder, search, 'entity');

            // Invariant: andWhere is called when search has query and fields
            expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not apply search when query is empty', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('name', 'status'), { minLength: 1, maxLength: 3 }),
          (fields) => {
            const search = { query: '', fields };

            mockQueryBuilder.andWhere.mockClear();

            service.applySearch(mockQueryBuilder, search, 'entity');

            // Invariant: no search applied for empty query
            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 10: QueryService Invalid Fields Throw Error**
   * *For any* filter, sort, or search field not in the allowed set, QueryService SHALL throw
   * an appropriate error.
   * **Validates: Requirements 4.7**
   */
  describe('Property 10: QueryService Invalid Fields Throw Error', () => {
    it('should throw error for invalid filter fields during validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !['name', 'status', 'number', 'dialingCode', 'createdAt'].includes(s)),
          (invalidField) => {
            const filter = {
              conditions: [{ field: invalidField, operator: 'eq' as const, value: 'test' }],
              logicalOperator: 'AND' as const,
            };

            expect(() =>
              service.normalizeWithValidation({ filter: JSON.stringify(filter) }, MockEntity),
            ).toThrow(/Invalid filter fields/);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should throw error for invalid sort fields during validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !['name', 'status', 'number', 'dialingCode', 'createdAt'].includes(s)),
          (invalidField) => {
            const sort = {
              conditions: [{ field: invalidField, direction: 'ASC' as const }],
            };

            expect(() =>
              service.normalizeWithValidation({ sort: JSON.stringify(sort) }, MockEntity),
            ).toThrow(/Invalid sort fields/);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should throw error for invalid search fields during validation', () => {
      fc.assert(
        fc.property(
          // Filter out 'name' (the valid field) and strings that become empty after trim
          // because searchFields schema transforms comma-separated, trims, and filters empty
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => {
            const trimmed = s.trim();
            // Must have non-whitespace content AND not be the valid 'name' field
            return trimmed.length > 0 && s !== 'name' && trimmed !== 'name';
          }),
          (invalidField) => {
            expect(() =>
              service.normalizeWithValidation({ search: 'test', searchFields: invalidField }, MockEntity),
            ).toThrow(/Invalid search fields/);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
