import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MetadataController } from './metadata.controller.js';
import { MetadataService, EntityMetadataResponse, SearchableFieldMetadata, FilterableFieldMetadata, SortableFieldMetadata } from './metadata.service.js';
import { EntityRegistry } from '../../common/database/entity-registry.service.js';
import type { Request } from 'express';

describe('MetadataController', () => {
  let controller: MetadataController;
  let metadataService: jest.Mocked<MetadataService>;
  let entityRegistry: jest.Mocked<EntityRegistry>;

  // Mock entity class for testing
  class MockEntity {}

  const mockSearchableFields: SearchableFieldMetadata[] = [
    { field: 'name', type: 'string', weight: 10, behavior: 'partial', examples: ['example', 'search term'] },
    { field: 'code', type: 'string', weight: 5, behavior: 'exact', examples: ['US', 'CA'] },
  ];

  const mockFilterableFields: FilterableFieldMetadata[] = [
    { field: 'id', type: 'integer', description: 'Unique identifier', examples: ['id:eq:1', 'id:gte:10'] },
    { field: 'name', type: 'varchar', description: 'Display name', examples: ['name:eq:value', 'name:contains:text'] },
  ];

  const mockSortableFields: SortableFieldMetadata[] = [
    { field: 'name', type: 'sortable', examples: ['name:ASC', 'name:DESC'] },
    { field: 'created', type: 'sortable', examples: ['created:ASC', 'created:DESC'] },
  ];

  const mockEntityMetadata: EntityMetadataResponse = {
    entity: {
      name: 'countries',
      description: 'Country reference data with ISO codes',
    },
    searchable: {
      total: 2,
      fields: mockSearchableFields,
      usage: {
        queryParam: 'search',
        example: '?search=example',
        description: 'Full-text search across all searchable fields',
      },
    },
    filterable: {
      total: 2,
      fields: mockFilterableFields,
      usage: {
        queryParam: 'filter',
        format: 'field:operator:value',
        example: '?filter=name:contains:test',
        description: 'Filter results by field values. Operators: eq, neq, gt, gte, lt, lte, contains, in',
      },
    },
    sortable: {
      total: 2,
      fields: mockSortableFields,
      usage: {
        queryParam: 'sort',
        format: 'field:direction',
        example: '?sort=name:ASC',
        description: 'Sort results. Direction: ASC or DESC',
      },
    },
    examples: {
      search: 'http://localhost:3000/v1/countries?search=example',
      filter: 'http://localhost:3000/v1/countries?filter=id:eq:1',
      sort: 'http://localhost:3000/v1/countries?sort=name:ASC',
      combined: 'http://localhost:3000/v1/countries?search=example&filter=id:gte:1&sort=name:DESC&limit=25&offset=0',
    },
  };

  const mockRequest = (overrides?: Partial<Request>): Request =>
    ({
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3000'),
      headers: {},
      path: '/v1/metadata',
      method: 'GET',
      ...overrides,
    }) as unknown as Request;

  beforeEach(async () => {
    // Create mock services
    metadataService = {
      getEntityMetadata: jest.fn(),
      getSearchableFields: jest.fn(),
      getFilterableFields: jest.fn(),
      getSortableFields: jest.fn(),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<MetadataService>;

    entityRegistry = {
      get: jest.fn(),
      getNames: jest.fn(),
      register: jest.fn(),
      has: jest.fn(),
      getOrFail: jest.fn(),
      getAll: jest.fn(),
      onModuleInit: jest.fn(),
    } as unknown as jest.Mocked<EntityRegistry>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetadataController],
      providers: [
        {
          provide: MetadataService,
          useValue: metadataService,
        },
        {
          provide: EntityRegistry,
          useValue: entityRegistry,
        },
        {
          provide: 'ENTITY_REGISTRY_INIT',
          useValue: entityRegistry,
        },
      ],
    }).compile();

    controller = module.get<MetadataController>(MetadataController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/metadata/entities (getAllEntities)', () => {
    /**
     * Test successful retrieval of all entities
     * Validates: Requirements 1.5
     */
    it('should return list of all available entities with metadata URLs', () => {
      const entityNames = ['countries', 'companies', 'regions', 'states'];
      entityRegistry.getNames.mockReturnValue(entityNames);

      const req = mockRequest();
      const result = controller.getAllEntities(req);

      expect(result.total).toBe(4);
      expect(result.entities).toHaveLength(4);
      expect(result.entities[0]).toEqual({
        name: 'countries',
        metadataUrl: 'http://localhost:3000/v1/countries/metadata',
        apiUrl: 'http://localhost:3000/v1/countries',
      });
      expect(entityRegistry.getNames).toHaveBeenCalled();
    });

    /**
     * Test empty entity list
     * Validates: Requirements 1.5
     */
    it('should return empty list when no entities are registered', () => {
      entityRegistry.getNames.mockReturnValue([]);

      const req = mockRequest();
      const result = controller.getAllEntities(req);

      expect(result.total).toBe(0);
      expect(result.entities).toEqual([]);
    });

    /**
     * Test correct URL generation with different protocols
     * Validates: Requirements 1.5
     */
    it('should generate correct URLs with https protocol', () => {
      entityRegistry.getNames.mockReturnValue(['countries']);

      const req = mockRequest({ protocol: 'https' });
      const result = controller.getAllEntities(req);

      expect(result.entities[0].metadataUrl).toBe('https://localhost:3000/v1/countries/metadata');
      expect(result.entities[0].apiUrl).toBe('https://localhost:3000/v1/countries');
    });
  });

  describe('GET /v1/:entity/metadata (getEntityMetadata)', () => {
    /**
     * Test successful retrieval of entity metadata
     * Validates: Requirements 1.5
     */
    it('should return complete metadata for a valid entity', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getEntityMetadata.mockReturnValue(mockEntityMetadata);

      const req = mockRequest();
      const result = controller.getEntityMetadata('countries', req);

      expect(result).toEqual(mockEntityMetadata);
      expect(entityRegistry.get).toHaveBeenCalledWith('countries');
      expect(metadataService.getEntityMetadata).toHaveBeenCalledWith(
        MockEntity,
        'countries',
        'http://localhost:3000/v1',
      );
    });

    /**
     * Test case-insensitive entity name handling
     * Validates: Requirements 1.5
     */
    it('should handle uppercase entity names', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getEntityMetadata.mockReturnValue(mockEntityMetadata);

      const req = mockRequest();
      controller.getEntityMetadata('COUNTRIES', req);

      expect(entityRegistry.get).toHaveBeenCalledWith('countries');
    });

    /**
     * Test 404 for unknown entity
     * Validates: Requirements 1.5, 1.7
     */
    it('should throw NotFoundException for unknown entity', () => {
      entityRegistry.get.mockReturnValue(undefined);
      entityRegistry.getNames.mockReturnValue(['countries', 'companies']);

      const req = mockRequest();

      expect(() => controller.getEntityMetadata('unknown', req)).toThrow(NotFoundException);
      expect(entityRegistry.get).toHaveBeenCalledWith('unknown');
    });

    /**
     * Test NotFoundException includes available entities
     * Validates: Requirements 1.5, 1.7
     */
    it('should include available entities in NotFoundException', () => {
      entityRegistry.get.mockReturnValue(undefined);
      entityRegistry.getNames.mockReturnValue(['countries', 'companies']);

      const req = mockRequest();

      try {
        controller.getEntityMetadata('unknown', req);
        fail('Expected NotFoundException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse() as any;
        expect(response.availableEntities).toEqual(['countries', 'companies']);
        expect(response.hint).toContain('countries');
      }
    });
  });

  describe('GET /v1/:entity/metadata/search (getSearchableFields)', () => {
    /**
     * Test successful retrieval of searchable fields
     * Validates: Requirements 1.5
     */
    it('should return searchable fields for a valid entity', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getSearchableFields.mockReturnValue(mockSearchableFields);

      const result = controller.getSearchableFields('countries');

      expect(result.total).toBe(2);
      expect(result.fields).toEqual(mockSearchableFields);
      expect(result.usage.queryParam).toBe('search');
      expect(result.usage.example).toBe('?search=United');
      expect(metadataService.getSearchableFields).toHaveBeenCalledWith(MockEntity);
    });

    /**
     * Test empty searchable fields
     * Validates: Requirements 1.5
     */
    it('should return empty fields array when entity has no searchable fields', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getSearchableFields.mockReturnValue([]);

      const result = controller.getSearchableFields('countries');

      expect(result.total).toBe(0);
      expect(result.fields).toEqual([]);
    });

    /**
     * Test 404 for unknown entity
     * Validates: Requirements 1.5, 1.7
     */
    it('should throw NotFoundException for unknown entity', () => {
      entityRegistry.get.mockReturnValue(undefined);
      entityRegistry.getNames.mockReturnValue(['countries']);

      expect(() => controller.getSearchableFields('unknown')).toThrow(NotFoundException);
    });
  });

  describe('GET /v1/:entity/metadata/filters (getFilterableFields)', () => {
    /**
     * Test successful retrieval of filterable fields
     * Validates: Requirements 1.5
     */
    it('should return filterable fields for a valid entity', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getFilterableFields.mockReturnValue(mockFilterableFields);

      const result = controller.getFilterableFields('countries');

      expect(result.total).toBe(2);
      expect(result.fields).toEqual(mockFilterableFields);
      expect(result.usage.queryParam).toBe('filter');
      expect(result.usage.format).toBe('field:operator:value');
      expect(result.usage.operators).toContain('eq');
      expect(metadataService.getFilterableFields).toHaveBeenCalledWith(MockEntity);
    });

    /**
     * Test empty filterable fields
     * Validates: Requirements 1.5
     */
    it('should return empty fields array when entity has no filterable fields', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getFilterableFields.mockReturnValue([]);

      const result = controller.getFilterableFields('countries');

      expect(result.total).toBe(0);
      expect(result.fields).toEqual([]);
    });

    /**
     * Test 404 for unknown entity
     * Validates: Requirements 1.5, 1.7
     */
    it('should throw NotFoundException for unknown entity', () => {
      entityRegistry.get.mockReturnValue(undefined);
      entityRegistry.getNames.mockReturnValue(['countries']);

      expect(() => controller.getFilterableFields('unknown')).toThrow(NotFoundException);
    });
  });

  describe('GET /v1/:entity/metadata/sort (getSortableFields)', () => {
    /**
     * Test successful retrieval of sortable fields
     * Validates: Requirements 1.5
     */
    it('should return sortable fields for a valid entity', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getSortableFields.mockReturnValue(mockSortableFields);

      const result = controller.getSortableFields('countries');

      expect(result.total).toBe(2);
      expect(result.fields).toEqual(mockSortableFields);
      expect(result.usage.queryParam).toBe('sort');
      expect(result.usage.format).toBe('field:direction');
      expect(result.usage.directions).toContain('ASC');
      expect(result.usage.directions).toContain('DESC');
      expect(metadataService.getSortableFields).toHaveBeenCalledWith(MockEntity);
    });

    /**
     * Test empty sortable fields
     * Validates: Requirements 1.5
     */
    it('should return empty fields array when entity has no sortable fields', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      metadataService.getSortableFields.mockReturnValue([]);

      const result = controller.getSortableFields('countries');

      expect(result.total).toBe(0);
      expect(result.fields).toEqual([]);
    });

    /**
     * Test 404 for unknown entity
     * Validates: Requirements 1.5, 1.7
     */
    it('should throw NotFoundException for unknown entity', () => {
      entityRegistry.get.mockReturnValue(undefined);
      entityRegistry.getNames.mockReturnValue(['countries']);

      expect(() => controller.getSortableFields('unknown')).toThrow(NotFoundException);
    });
  });

  describe('Error Handling', () => {
    /**
     * Test error propagation from MetadataService
     * Validates: Requirements 1.7
     */
    it('should propagate errors from MetadataService.getEntityMetadata', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      const error = new Error('Service error');
      metadataService.getEntityMetadata.mockImplementation(() => {
        throw error;
      });

      const req = mockRequest();

      expect(() => controller.getEntityMetadata('countries', req)).toThrow(error);
    });

    /**
     * Test error propagation from MetadataService.getSearchableFields
     * Validates: Requirements 1.7
     */
    it('should propagate errors from MetadataService.getSearchableFields', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      const error = new Error('Service error');
      metadataService.getSearchableFields.mockImplementation(() => {
        throw error;
      });

      expect(() => controller.getSearchableFields('countries')).toThrow(error);
    });

    /**
     * Test error propagation from MetadataService.getFilterableFields
     * Validates: Requirements 1.7
     */
    it('should propagate errors from MetadataService.getFilterableFields', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      const error = new Error('Service error');
      metadataService.getFilterableFields.mockImplementation(() => {
        throw error;
      });

      expect(() => controller.getFilterableFields('countries')).toThrow(error);
    });

    /**
     * Test error propagation from MetadataService.getSortableFields
     * Validates: Requirements 1.7
     */
    it('should propagate errors from MetadataService.getSortableFields', () => {
      entityRegistry.get.mockReturnValue(MockEntity);
      const error = new Error('Service error');
      metadataService.getSortableFields.mockImplementation(() => {
        throw error;
      });

      expect(() => controller.getSortableFields('countries')).toThrow(error);
    });
  });

  describe('URL Generation', () => {
    /**
     * Test URL generation with different hosts
     * Validates: Requirements 1.5
     */
    it('should generate correct URLs with custom host', () => {
      entityRegistry.getNames.mockReturnValue(['countries']);

      const req = mockRequest();
      (req.get as jest.Mock).mockReturnValue('api.example.com');

      const result = controller.getAllEntities(req);

      expect(result.entities[0].metadataUrl).toBe('http://api.example.com/v1/countries/metadata');
    });

    /**
     * Test URL generation with port
     * Validates: Requirements 1.5
     */
    it('should generate correct URLs with port in host', () => {
      entityRegistry.getNames.mockReturnValue(['countries']);

      const req = mockRequest();
      (req.get as jest.Mock).mockReturnValue('localhost:8080');

      const result = controller.getAllEntities(req);

      expect(result.entities[0].metadataUrl).toBe('http://localhost:8080/v1/countries/metadata');
    });
  });
});
