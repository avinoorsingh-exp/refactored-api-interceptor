import { QueryService } from './query.service.js';
import { SelectQueryBuilder } from 'typeorm';
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

describe('QueryService', () => {
  let service: QueryService;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;

  beforeEach(() => {
    service = new QueryService();

    // Create mock query builder
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
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

      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should not modify query builder when sort has no conditions', () => {
      const sort: Sort = { conditions: [] };

      service.applySorting(mockQueryBuilder, sort, 'entity');

      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should apply single sort condition with reserved word quoting', () => {
      const sort: Sort = {
        conditions: [{ field: 'name', direction: 'ASC' }],
      };

      service.applySorting(mockQueryBuilder, sort, 'entity');

      // 'name' is a reserved word and should be quoted
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('entity."name"', 'ASC');
    });

    it('should apply multiple sort conditions with proper quoting', () => {
      const sort: Sort = {
        conditions: [
          { field: 'status', direction: 'ASC' },    // not a reserved word
          { field: 'createdAt', direction: 'DESC' }, // not a reserved word
        ],
      };

      service.applySorting(mockQueryBuilder, sort, 'entity');

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('entity.status', 'ASC');
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
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('country."number"', 'ASC');
    });

    it('should not quote non-reserved word column (dialingCode) when sorting', () => {
      const sort: Sort = {
        conditions: [{ field: 'dialingCode', direction: 'DESC' }],
      };

      service.applySorting(mockQueryBuilder, sort, 'country');

      // 'dialingCode' is not a reserved word, should not be quoted
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('country.dialingCode', 'DESC');
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

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('country."name"', 'ASC');
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
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalled();
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
});
