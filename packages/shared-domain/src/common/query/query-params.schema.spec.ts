
import { QueryParamsSchema, SimpleQueryParamsSchema, parseSimpleFilters } from './index.js';

describe('QueryParamsSchema', () => {
  it('should parse complex query params with JSON', () => {
    const input = {
      offset: '0',
      limit: '20',
      filter: JSON.stringify({
        conditions: [
          { field: 'status', operator: 'eq', value: 'COMPLETED' },
        ],
        logicalOperator: 'AND',
      }),
      sort: JSON.stringify({
        conditions: [
          { field: 'createdAt', direction: 'DESC' },
        ],
      }),
    };

    const result = QueryParamsSchema.parse(input);

    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.filter?.conditions).toHaveLength(1);
    expect(result.sort?.conditions).toHaveLength(1);
  });

  it('should use default values for pagination', () => {
    const input = {};
    const result = QueryParamsSchema.parse(input);

    expect(result.offset).toBe(0);
    expect(result.limit).toBe(10);
  });

  it('should reject invalid filter JSON', () => {
    const input = {
      filter: 'invalid json',
    };

    expect(() => QueryParamsSchema.parse(input)).toThrow('Invalid filter JSON');
  });
});

describe('SimpleQueryParamsSchema', () => {
  it('should parse simple query params', () => {
    const input = {
      offset: '0',
      limit: '20',
      status: 'COMPLETED',
      'amount[gte]': '1000',
      sort: '-createdAt,amount',
      q: 'john',
      searchFields: 'name,email',
    };

    const result = SimpleQueryParamsSchema.parse(input);

    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.sort?.conditions).toHaveLength(2);
    expect(result.sort?.conditions[0].direction).toBe('DESC');
    expect(result.q).toBe('john');
    expect(result.searchFields).toEqual(['name', 'email']);
  });

  it('should parse simple filters', () => {
    const params = {
      status: 'COMPLETED',
      'amount[gte]': '1000',
      'amount[lte]': '5000',
    };

    const filters = parseSimpleFilters(params);

    expect(filters).toHaveLength(3);
    expect(filters[0]).toEqual({ field: 'status', operator: 'eq', value: 'COMPLETED' });
    expect(filters[1]).toEqual({ field: 'amount', operator: 'gte', value: 1000 });
    expect(filters[2]).toEqual({ field: 'amount', operator: 'lte', value: 5000 });
  });
});