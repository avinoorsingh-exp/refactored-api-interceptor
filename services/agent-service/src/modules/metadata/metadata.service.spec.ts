import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityMetadata, ColumnMetadata } from 'typeorm';
import { MetadataService, EntityMetadataResponse, SearchableFieldMetadata, FilterableFieldMetadata, SortableFieldMetadata } from './metadata.service.js';

// Mock the @exprealty/database decorators
jest.mock('@exprealty/database', () => ({
  getSearchableFields: jest.fn(),
  getSearchableFieldsConfig: jest.fn(),
  getFilterableFields: jest.fn(),
  getSortableFields: jest.fn(),
}));

import {
  getSearchableFields,
  getSearchableFieldsConfig,
  getFilterableFields,
  getSortableFields,
} from '@exprealty/database';

/**
 * Unit tests for MetadataService
 * Tests getEntityMetadata(), caching behavior, field metadata extraction
 * Validates: Requirements 2.5
 */
describe('MetadataService', () => {
  let service: MetadataService;
  let dataSource: jest.Mocked<DataSource>;

  // Mock entity class for testing
  class MockEntity {
    id!: number;
    name!: string;
    code!: string;
    isActive!: boolean;
    created!: Date;
  }

  const mockColumnMetadata = (propertyName: string, type: string): Partial<ColumnMetadata> => ({
    propertyName,
    type,
  });

  const mockEntityMetadata: Partial<EntityMetadata> = {
    columns: [
      mockColumnMetadata('id', 'integer'),
      mockColumnMetadata('name', 'varchar'),
      mockColumnMetadata('code', 'varchar'),
      mockColumnMetadata('isActive', 'boolean'),
      mockColumnMetadata('created', 'timestamp'),
    ] as ColumnMetadata[],
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock DataSource
    dataSource = {
      getMetadata: jest.fn().mockReturnValue(mockEntityMetadata),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetadataService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
  });

  afterEach(() => {
    // Clear the cache after each test
    service.clearCache();
    jest.clearAllMocks();
  });

  describe('getEntityMetadata', () => {
    beforeEach(() => {
      // Setup default mock returns
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['name', { type: 'string', weight: 10, behavior: 'partial', description: 'Display name' }],
          ['code', { type: 'string', weight: 5, behavior: 'exact' }],
        ])
      );
      (getFilterableFields as jest.Mock).mockReturnValue(['id', 'name', 'isActive']);
      (getSortableFields as jest.Mock).mockReturnValue(['name', 'created']);
    });

    /**
     * Test successful metadata retrieval
     * Validates: Requirements 2.5
     */
    it('should return complete entity metadata', () => {
      const result = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');

      expect(result.entity.name).toBe('countries');
      expect(result.entity.description).toBe('Country reference data with ISO codes');
      expect(result.searchable.total).toBe(2);
      expect(result.filterable.total).toBe(3);
      expect(result.sortable.total).toBe(2);
    });

    /**
     * Test searchable fields metadata structure
     * Validates: Requirements 2.5
     */
    it('should return correct searchable field metadata', () => {
      const result = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');

      expect(result.searchable.fields).toHaveLength(2);
      expect(result.searchable.fields[0]).toMatchObject({
        field: 'name',
        type: 'string',
        weight: 10,
        behavior: 'partial',
      });
      expect(result.searchable.usage.queryParam).toBe('search');
    });

    /**
     * Test filterable fields metadata structure
     * Validates: Requirements 2.5
     */
    it('should return correct filterable field metadata', () => {
      const result = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');

      expect(result.filterable.fields).toHaveLength(3);
      expect(result.filterable.fields[0].field).toBe('id');
      expect(result.filterable.usage.queryParam).toBe('filter');
      expect(result.filterable.usage.format).toBe('field:operator:value');
    });

    /**
     * Test sortable fields metadata structure
     * Validates: Requirements 2.5
     */
    it('should return correct sortable field metadata', () => {
      const result = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');

      expect(result.sortable.fields).toHaveLength(2);
      expect(result.sortable.fields[0].field).toBe('name');
      expect(result.sortable.fields[0].examples).toContain('name:ASC');
      expect(result.sortable.fields[0].examples).toContain('name:DESC');
      expect(result.sortable.usage.queryParam).toBe('sort');
    });

    /**
     * Test example URLs generation
     * Validates: Requirements 2.5
     */
    it('should generate correct example URLs', () => {
      const result = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');

      expect(result.examples.search).toContain('http://localhost:3000/v1/countries');
      expect(result.examples.search).toContain('search=');
      expect(result.examples.filter).toContain('filter=');
      expect(result.examples.sort).toContain('sort=');
      expect(result.examples.combined).toContain('search=');
      expect(result.examples.combined).toContain('filter=');
      expect(result.examples.combined).toContain('sort=');
    });

    /**
     * Test entity descriptions for known entities
     * Validates: Requirements 2.5
     */
    it('should return correct descriptions for known entities', () => {
      const countriesResult = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');
      expect(countriesResult.entity.description).toBe('Country reference data with ISO codes');

      service.clearCache();
      const companiesResult = service.getEntityMetadata(MockEntity, 'companies', 'http://localhost:3000/v1');
      expect(companiesResult.entity.description).toBe('Company/brokerage information');

      service.clearCache();
      const regionsResult = service.getEntityMetadata(MockEntity, 'regions', 'http://localhost:3000/v1');
      expect(regionsResult.entity.description).toBe('Geographic regions within countries');

      service.clearCache();
      const statesResult = service.getEntityMetadata(MockEntity, 'states', 'http://localhost:3000/v1');
      expect(statesResult.entity.description).toBe('State/province data with programs');
    });

    /**
     * Test default description for unknown entities
     * Validates: Requirements 2.5
     */
    it('should return default description for unknown entities', () => {
      const result = service.getEntityMetadata(MockEntity, 'unknown', 'http://localhost:3000/v1');
      expect(result.entity.description).toBe('unknown entity');
    });
  });

  describe('caching behavior', () => {
    beforeEach(() => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(new Map([['name', { type: 'string', weight: 5 }]]));
      (getFilterableFields as jest.Mock).mockReturnValue(['id']);
      (getSortableFields as jest.Mock).mockReturnValue(['name']);
    });

    /**
     * Test that metadata is cached
     * Validates: Requirements 2.5
     */
    it('should cache metadata and return cached result on subsequent calls', () => {
      const baseUrl = 'http://localhost:3000/v1';
      
      // First call
      const result1 = service.getEntityMetadata(MockEntity, 'countries', baseUrl);
      
      // Second call with same parameters
      const result2 = service.getEntityMetadata(MockEntity, 'countries', baseUrl);

      // Should return the same cached object
      expect(result1).toBe(result2);
      
      // getSearchableFieldsConfig should only be called once
      expect(getSearchableFieldsConfig).toHaveBeenCalledTimes(1);
    });

    /**
     * Test that different cache keys produce different results
     * Validates: Requirements 2.5
     */
    it('should use different cache entries for different entity names', () => {
      const baseUrl = 'http://localhost:3000/v1';
      
      const result1 = service.getEntityMetadata(MockEntity, 'countries', baseUrl);
      const result2 = service.getEntityMetadata(MockEntity, 'companies', baseUrl);

      expect(result1.entity.name).toBe('countries');
      expect(result2.entity.name).toBe('companies');
      expect(result1).not.toBe(result2);
    });

    /**
     * Test that different base URLs produce different cache entries
     * Validates: Requirements 2.5
     */
    it('should use different cache entries for different base URLs', () => {
      const result1 = service.getEntityMetadata(MockEntity, 'countries', 'http://localhost:3000/v1');
      const result2 = service.getEntityMetadata(MockEntity, 'countries', 'https://api.example.com/v1');

      expect(result1.examples.search).toContain('localhost:3000');
      expect(result2.examples.search).toContain('api.example.com');
    });

    /**
     * Test cache clearing
     * Validates: Requirements 2.5
     */
    it('should clear cache when clearCache is called', () => {
      const baseUrl = 'http://localhost:3000/v1';
      
      // First call
      service.getEntityMetadata(MockEntity, 'countries', baseUrl);
      expect(getSearchableFieldsConfig).toHaveBeenCalledTimes(1);
      
      // Clear cache
      service.clearCache();
      
      // Second call should fetch again
      service.getEntityMetadata(MockEntity, 'countries', baseUrl);
      expect(getSearchableFieldsConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSearchableFields', () => {
    /**
     * Test public API for searchable fields
     * Validates: Requirements 2.5
     */
    it('should return searchable field metadata', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['name', { type: 'string', weight: 10, behavior: 'partial' }],
          ['code', { type: 'string', weight: 5, behavior: 'exact' }],
        ])
      );

      const result = service.getSearchableFields(MockEntity);

      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('name');
      expect(result[0].type).toBe('string');
      expect(result[0].weight).toBe(10);
    });

    /**
     * Test fallback when getSearchableFieldsConfig throws
     * Validates: Requirements 2.5
     */
    it('should fallback to simple field list when config throws', () => {
      (getSearchableFieldsConfig as jest.Mock).mockImplementation(() => {
        throw new Error('No config');
      });
      (getSearchableFields as jest.Mock).mockReturnValue(['name', 'code']);

      const result = service.getSearchableFields(MockEntity);

      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('name');
      expect(result[0].type).toBe('string');
      expect(result[0].weight).toBe(5); // Default weight
    });

    /**
     * Test empty searchable fields
     * Validates: Requirements 2.5
     */
    it('should return empty array when no searchable fields', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(new Map());

      const result = service.getSearchableFields(MockEntity);

      expect(result).toEqual([]);
    });
  });

  describe('getFilterableFields', () => {
    /**
     * Test public API for filterable fields
     * Validates: Requirements 2.5
     */
    it('should return filterable field metadata', () => {
      (getFilterableFields as jest.Mock).mockReturnValue(['id', 'name', 'isActive']);

      const result = service.getFilterableFields(MockEntity);

      expect(result).toHaveLength(3);
      expect(result[0].field).toBe('id');
      expect(result[0].type).toBe('integer');
    });

    /**
     * Test field type detection from TypeORM metadata
     * Validates: Requirements 2.5
     */
    it('should detect correct column types from TypeORM metadata', () => {
      (getFilterableFields as jest.Mock).mockReturnValue(['id', 'name', 'isActive', 'created']);

      const result = service.getFilterableFields(MockEntity);

      const idField = result.find(f => f.field === 'id');
      const nameField = result.find(f => f.field === 'name');
      const isActiveField = result.find(f => f.field === 'isActive');
      const createdField = result.find(f => f.field === 'created');

      expect(idField?.type).toBe('integer');
      expect(nameField?.type).toBe('varchar');
      expect(isActiveField?.type).toBe('boolean');
      expect(createdField?.type).toBe('timestamp');
    });

    /**
     * Test filter examples for different types
     * Validates: Requirements 2.5
     */
    it('should generate appropriate filter examples for different types', () => {
      (getFilterableFields as jest.Mock).mockReturnValue(['id', 'name', 'isActive', 'created']);

      const result = service.getFilterableFields(MockEntity);

      const idField = result.find(f => f.field === 'id');
      const nameField = result.find(f => f.field === 'name');
      const isActiveField = result.find(f => f.field === 'isActive');
      const createdField = result.find(f => f.field === 'created');

      // Integer fields should have numeric examples
      expect(idField?.examples?.some(e => e.includes(':eq:'))).toBe(true);
      
      // String fields should have contains examples
      expect(nameField?.examples?.some(e => e.includes(':contains:'))).toBe(true);
      
      // Boolean fields should have true/false examples
      expect(isActiveField?.examples?.some(e => e.includes(':eq:true'))).toBe(true);
      
      // Date fields should have date examples
      expect(createdField?.examples?.some(e => e.includes(':gte:'))).toBe(true);
    });

    /**
     * Test empty filterable fields
     * Validates: Requirements 2.5
     */
    it('should return empty array when no filterable fields', () => {
      (getFilterableFields as jest.Mock).mockReturnValue([]);

      const result = service.getFilterableFields(MockEntity);

      expect(result).toEqual([]);
    });

    /**
     * Test handling of unknown column type
     * Validates: Requirements 2.5
     */
    it('should handle unknown column types gracefully', () => {
      dataSource.getMetadata.mockImplementation(() => {
        throw new Error('Entity not found');
      });
      (getFilterableFields as jest.Mock).mockReturnValue(['unknownField']);

      const result = service.getFilterableFields(MockEntity);

      expect(result[0].type).toBe('unknown');
    });
  });

  describe('getSortableFields', () => {
    /**
     * Test public API for sortable fields
     * Validates: Requirements 2.5
     */
    it('should return sortable field metadata', () => {
      (getSortableFields as jest.Mock).mockReturnValue(['name', 'created']);

      const result = service.getSortableFields(MockEntity);

      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('name');
      expect(result[0].type).toBe('sortable');
      expect(result[0].examples).toContain('name:ASC');
      expect(result[0].examples).toContain('name:DESC');
    });

    /**
     * Test empty sortable fields
     * Validates: Requirements 2.5
     */
    it('should return empty array when no sortable fields', () => {
      (getSortableFields as jest.Mock).mockReturnValue([]);

      const result = service.getSortableFields(MockEntity);

      expect(result).toEqual([]);
    });
  });

  describe('field descriptions', () => {
    beforeEach(() => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(new Map());
      (getSortableFields as jest.Mock).mockReturnValue([]);
    });

    /**
     * Test known field descriptions
     * Validates: Requirements 2.5
     */
    it('should return descriptions for known fields', () => {
      (getFilterableFields as jest.Mock).mockReturnValue(['id', 'name', 'code', 'alpha2', 'alpha3', 'number', 'dialingCode', 'created', 'lastModified']);

      const result = service.getFilterableFields(MockEntity);

      const idField = result.find(f => f.field === 'id');
      const nameField = result.find(f => f.field === 'name');
      const codeField = result.find(f => f.field === 'code');
      const alpha2Field = result.find(f => f.field === 'alpha2');

      expect(idField?.description).toBe('Unique identifier');
      expect(nameField?.description).toBe('Display name');
      expect(codeField?.description).toBe('Short code identifier');
      expect(alpha2Field?.description).toBe('ISO 3166-1 alpha-2 code');
    });

    /**
     * Test unknown field has no description
     * Validates: Requirements 2.5
     */
    it('should return undefined description for unknown fields', () => {
      (getFilterableFields as jest.Mock).mockReturnValue(['unknownField']);

      const result = service.getFilterableFields(MockEntity);

      expect(result[0].description).toBeUndefined();
    });
  });

  describe('search examples by type and behavior', () => {
    /**
     * Test search examples for range behavior
     * Validates: Requirements 2.5
     */
    it('should generate range examples for numeric fields with range behavior', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['amount', { type: 'numeric', behavior: 'range' }],
        ])
      );

      const result = service.getSearchableFields(MockEntity);

      expect(result[0].examples).toContain('123');
      expect(result[0].examples).toContain('100-500');
      expect(result[0].examples).toContain('>100');
    });

    /**
     * Test search examples for date fields with range behavior
     * Validates: Requirements 2.5
     */
    it('should generate date range examples for date fields with range behavior', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['created', { type: 'date', behavior: 'range' }],
        ])
      );

      const result = service.getSearchableFields(MockEntity);

      expect(result[0].examples).toContain('2024');
      expect(result[0].examples).toContain('2024-01');
      expect(result[0].examples).toContain('>2024-01-01');
    });

    /**
     * Test search examples for exact behavior
     * Validates: Requirements 2.5
     */
    it('should generate exact match examples for exact behavior', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['code', { type: 'string', behavior: 'exact' }],
        ])
      );

      const result = service.getSearchableFields(MockEntity);

      expect(result[0].examples).toContain('exact value');
      expect(result[0].examples).toContain('US');
    });

    /**
     * Test search examples for boolean fields
     * Validates: Requirements 2.5
     */
    it('should generate boolean examples for boolean fields', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['isActive', { type: 'boolean', behavior: 'exact' }],
        ])
      );

      const result = service.getSearchableFields(MockEntity);

      expect(result[0].examples).toContain('true');
      expect(result[0].examples).toContain('false');
    });
  });

  describe('behavior inference', () => {
    /**
     * Test behavior inference for different types
     * Validates: Requirements 2.5
     */
    it('should infer correct behavior from field type', () => {
      (getSearchableFieldsConfig as jest.Mock).mockReturnValue(
        new Map([
          ['name', { type: 'string' }], // Should infer 'partial'
          ['count', { type: 'integer' }], // Should infer 'range'
          ['created', { type: 'date' }], // Should infer 'range'
          ['isActive', { type: 'boolean' }], // Should infer 'exact'
        ])
      );

      const result = service.getSearchableFields(MockEntity);

      const nameField = result.find(f => f.field === 'name');
      const countField = result.find(f => f.field === 'count');
      const createdField = result.find(f => f.field === 'created');
      const isActiveField = result.find(f => f.field === 'isActive');

      expect(nameField?.behavior).toBe('partial');
      expect(countField?.behavior).toBe('range');
      expect(createdField?.behavior).toBe('range');
      expect(isActiveField?.behavior).toBe('exact');
    });
  });
});
