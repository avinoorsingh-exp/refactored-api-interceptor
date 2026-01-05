/**
 * Property-Based Tests for Search Strategies
 *
 * **Feature: agent-service-coverage, Property 23: Search Strategy Type Handling**
 * *For any* search query, each search strategy (string, numeric, date, boolean)
 * SHALL correctly identify if it can handle the query and apply the appropriate SQL condition.
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
 */

import * as fc from 'fast-check';
import { StringSearchStrategy } from './string-search.strategy.js';
import { NumericSearchStrategy } from './numeric-search.strategy.js';
import { DateSearchStrategy } from './date-search.strategy.js';
import { BooleanSearchStrategy } from './boolean-search.strategy.js';
import { SelectQueryBuilder } from 'typeorm';
import { SearchableFieldConfig, SearchableFieldType } from '@exprealty/database';
import { ColumnResolverService } from '../column-resolver.service.js';

describe('Search Strategies - Property-Based Tests', () => {
  // Mock query builder factory
  const createMockQueryBuilder = () => ({
    orWhere: jest.fn().mockReturnThis(),
    expressionMap: {
      mainAlias: {
        metadata: {
          target: class MockEntity {},
        },
      },
    },
  } as unknown as jest.Mocked<SelectQueryBuilder<any>>);

  // Mock column resolver
  const createMockColumnResolver = () => ({
    getColumnName: jest.fn().mockImplementation((_, field) => field),
  } as unknown as jest.Mocked<ColumnResolverService>);

  /**
   * **Feature: agent-service-coverage, Property 23: Search Strategy Type Handling**
   * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
   */
  describe('Property 23: Search Strategy Type Handling', () => {
    describe('StringSearchStrategy', () => {
      let strategy: StringSearchStrategy;

      beforeEach(() => {
        strategy = new StringSearchStrategy();
      });

      it('should always be able to handle any search term', () => {
        fc.assert(
          fc.property(
            fc.string(),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'name',
                type: SearchableFieldType.STRING,
              };

              // StringSearchStrategy should always return true for canHandle
              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should apply ILIKE search for any non-empty search term', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.constantFrom('name', 'code', 'description'),
            fc.constantFrom('entity', 'state', 'listing'),
            (searchTerm, field, alias) => {
              const mockQb = createMockQueryBuilder();

              strategy.applySearch(mockQb, alias, field, searchTerm, 'param_0');

              // Should always call orWhere with ILIKE pattern
              expect(mockQb.orWhere).toHaveBeenCalledTimes(1);
              const [query, params] = mockQb.orWhere.mock.calls[0];
              expect(query).toContain('ILIKE');
              expect(query).toContain(`${alias}.${field}`);
              expect(params.param_0).toContain(searchTerm);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('BooleanSearchStrategy', () => {
      let strategy: BooleanSearchStrategy;

      beforeEach(() => {
        strategy = new BooleanSearchStrategy();
      });

      const trueValues = ['true', 'yes', '1', 'y', 't', 'TRUE', 'YES', 'Y', 'T'];
      const falseValues = ['false', 'no', '0', 'n', 'f', 'FALSE', 'NO', 'N', 'F'];

      it('should handle all truthy boolean string values', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...trueValues),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'isActive',
                type: SearchableFieldType.BOOLEAN,
              };

              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 50 },
        );
      });

      it('should handle all falsy boolean string values', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...falseValues),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'isActive',
                type: SearchableFieldType.BOOLEAN,
              };

              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 50 },
        );
      });

      it('should not handle non-boolean string values', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }).filter(
              (s) => !trueValues.includes(s.toLowerCase().trim()) &&
                     !falseValues.includes(s.toLowerCase().trim()),
            ),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'isActive',
                type: SearchableFieldType.BOOLEAN,
              };

              expect(strategy.canHandle(searchTerm, config)).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should apply correct boolean value for truthy inputs', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...trueValues),
            fc.constantFrom('isActive', 'hasPool', 'enabled'),
            (searchTerm, field) => {
              const mockQb = createMockQueryBuilder();

              strategy.applySearch(mockQb, 'entity', field, searchTerm, 'param_0');

              expect(mockQb.orWhere).toHaveBeenCalledWith(
                `entity.${field} = :param_0`,
                { param_0: true },
              );
            },
          ),
          { numRuns: 50 },
        );
      });

      it('should apply correct boolean value for falsy inputs', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...falseValues),
            fc.constantFrom('isActive', 'hasPool', 'enabled'),
            (searchTerm, field) => {
              const mockQb = createMockQueryBuilder();

              strategy.applySearch(mockQb, 'entity', field, searchTerm, 'param_0');

              expect(mockQb.orWhere).toHaveBeenCalledWith(
                `entity.${field} = :param_0`,
                { param_0: false },
              );
            },
          ),
          { numRuns: 50 },
        );
      });
    });

    describe('NumericSearchStrategy', () => {
      let strategy: NumericSearchStrategy;
      let mockColumnResolver: jest.Mocked<ColumnResolverService>;

      beforeEach(() => {
        mockColumnResolver = createMockColumnResolver();
        strategy = new NumericSearchStrategy(mockColumnResolver);
      });

      it('should handle numeric string values', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 1000000 }).map(String),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'price',
                type: SearchableFieldType.NUMERIC,
              };

              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle decimal string values', () => {
        fc.assert(
          fc.property(
            fc.float({ min: 0, max: 1000000, noNaN: true }).map((n) => n.toFixed(2)),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'price',
                type: SearchableFieldType.NUMERIC,
              };

              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle range patterns', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10000 }),
            fc.integer({ min: 0, max: 10000 }),
            (min, max) => {
              const searchTerm = `${min}-${max}`;
              const config: SearchableFieldConfig = {
                field: 'price',
                type: SearchableFieldType.NUMERIC,
              };

              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should apply BETWEEN for range patterns', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10000 }),
            fc.integer({ min: 0, max: 10000 }),
            (min, max) => {
              const mockQb = createMockQueryBuilder();
              const searchTerm = `${min}-${max}`;

              strategy.applySearch(mockQb, 'listing', 'price', searchTerm, 'param_0');

              expect(mockQb.orWhere).toHaveBeenCalled();
              const [query] = mockQb.orWhere.mock.calls[0];
              expect(query).toContain('BETWEEN');
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('DateSearchStrategy', () => {
      let strategy: DateSearchStrategy;
      let mockColumnResolver: jest.Mocked<ColumnResolverService>;

      beforeEach(() => {
        mockColumnResolver = createMockColumnResolver();
        strategy = new DateSearchStrategy(mockColumnResolver);
      });

      it('should always be able to handle any search term', () => {
        fc.assert(
          fc.property(
            fc.string(),
            (searchTerm) => {
              const config: SearchableFieldConfig = {
                field: 'createdAt',
                type: SearchableFieldType.DATE,
              };

              // DateSearchStrategy should always return true for canHandle
              expect(strategy.canHandle(searchTerm, config)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle year patterns (4 digits)', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1900, max: 2100 }).map(String),
            (year) => {
              const mockQb = createMockQueryBuilder();

              strategy.applySearch(mockQb, 'entity', 'createdAt', year, 'param_0');

              // Should apply year search (Brackets for combined conditions)
              expect(mockQb.orWhere).toHaveBeenCalled();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle YYYY-MM patterns', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 2000, max: 2030 }),
            fc.integer({ min: 1, max: 12 }),
            (year, month) => {
              const mockQb = createMockQueryBuilder();
              const searchTerm = `${year}-${String(month).padStart(2, '0')}`;

              strategy.applySearch(mockQb, 'entity', 'createdAt', searchTerm, 'param_0');

              expect(mockQb.orWhere).toHaveBeenCalled();
              const [query] = mockQb.orWhere.mock.calls[0];
              // DateSearchStrategy uses >= AND < for month ranges
              expect(query).toMatch(/>= .* AND .* </);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle YYYY-MM-DD patterns', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 2000, max: 2030 }),
            fc.integer({ min: 1, max: 12 }),
            fc.integer({ min: 1, max: 28 }),
            (year, month, day) => {
              const mockQb = createMockQueryBuilder();
              const searchTerm = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

              strategy.applySearch(mockQb, 'entity', 'createdAt', searchTerm, 'param_0');

              expect(mockQb.orWhere).toHaveBeenCalled();
              const [query, params] = mockQb.orWhere.mock.calls[0];
              // DateSearchStrategy uses >= AND <= for full day range on timestamps
              expect(query).toMatch(/>= .* AND .* <=/);
              expect(params.param_0_dayStart).toContain(searchTerm);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Cross-Strategy Type Discrimination', () => {
      it('should have mutually exclusive handling for boolean vs other strategies', () => {
        const booleanStrategy = new BooleanSearchStrategy();
        const stringStrategy = new StringSearchStrategy();

        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            (searchTerm) => {
              const boolConfig: SearchableFieldConfig = {
                field: 'isActive',
                type: SearchableFieldType.BOOLEAN,
              };
              const stringConfig: SearchableFieldConfig = {
                field: 'name',
                type: SearchableFieldType.STRING,
              };

              const boolCanHandle = booleanStrategy.canHandle(searchTerm, boolConfig);
              const stringCanHandle = stringStrategy.canHandle(searchTerm, stringConfig);

              // String strategy always handles, boolean only handles specific values
              expect(stringCanHandle).toBe(true);

              // If boolean can handle, it should be a recognized boolean value
              if (boolCanHandle) {
                const normalized = searchTerm.toLowerCase().trim();
                const validBooleans = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n', 't', 'f'];
                expect(validBooleans).toContain(normalized);
              }
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});
