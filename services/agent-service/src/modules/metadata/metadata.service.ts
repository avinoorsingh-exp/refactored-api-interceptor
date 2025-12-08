import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  getSearchableFields,
  getSearchableFieldsConfig,
  getFilterableFields,
  getSortableFields,
  SearchableFieldType,
  SearchableOptions,
} from '@exprealty/database';

/**
 * Searchable field metadata for UI builders
 * Matches SearchableFieldDto from shared-domain
 */
export interface SearchableFieldMetadata {
  field: string;
  type: string;
  weight: number;
  behavior?: string;
  examples: string[];
  description?: string;
}

/**
 * Filterable field metadata
 */
export interface FilterableFieldMetadata {
  field: string;
  type: string;
  description?: string;
  examples?: string[];
}

/**
 * Sortable field metadata
 */
export interface SortableFieldMetadata {
  field: string;
  type: string;
  examples: string[];
}

/**
 * Complete entity metadata response
 */
export interface EntityMetadataResponse {
  entity: {
    name: string;
    description?: string;
  };
  searchable: {
    total: number;
    fields: SearchableFieldMetadata[];
    usage: {
      queryParam: string;
      example: string;
      description: string;
    };
  };
  filterable: {
    total: number;
    fields: FilterableFieldMetadata[];
    usage: {
      queryParam: string;
      format: string;
      example: string;
      description: string;
    };
  };
  sortable: {
    total: number;
    fields: SortableFieldMetadata[];
    usage: {
      queryParam: string;
      format: string;
      example: string;
      description: string;
    };
  };
  examples: {
    search: string;
    filter: string;
    sort: string;
    combined: string;
  };
}

/**
 * Metadata Service
 * 
 * Provides metadata about queryable entity fields.
 * Used by dynamic UI builders to understand API capabilities.
 * 
 * Features:
 * - Auto-discovers @Searchable, @Filterable, @Sortable decorated fields
 * - Returns UI-ready format with examples
 * - Cached for performance (via caller)
 */
@Injectable()
export class MetadataService {
  private readonly cache = new Map<string, EntityMetadataResponse>();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get complete metadata for an entity
   * Results are cached for 1 hour
   */
  getEntityMetadata<T>(
    entityClass: new () => T,
    entityName: string,
    baseUrl: string,
  ): EntityMetadataResponse {
    const cacheKey = `${entityName}:${baseUrl}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const searchableFields = this.getSearchableFieldMetadata(entityClass);
    const filterableFields = this.getFilterableFieldMetadata(entityClass);
    const sortableFields = this.getSortableFieldMetadata(entityClass);

    const metadata: EntityMetadataResponse = {
      entity: {
        name: entityName,
        description: this.getEntityDescription(entityName),
      },
      searchable: {
        total: searchableFields.length,
        fields: searchableFields,
        usage: {
          queryParam: 'search',
          example: `?search=example`,
          description: 'Full-text search across all searchable fields',
        },
      },
      filterable: {
        total: filterableFields.length,
        fields: filterableFields,
        usage: {
          queryParam: 'filter',
          format: 'field:operator:value',
          example: `?filter=name:contains:test`,
          description: 'Filter results by field values. Operators: eq, neq, gt, gte, lt, lte, contains, in',
        },
      },
      sortable: {
        total: sortableFields.length,
        fields: sortableFields,
        usage: {
          queryParam: 'sort',
          format: 'field:direction',
          example: `?sort=name:ASC`,
          description: 'Sort results. Direction: ASC or DESC',
        },
      },
      examples: this.buildExamples(entityName, baseUrl, searchableFields, filterableFields, sortableFields),
    };

    // Cache for 1 hour (will be cleared on restart)
    this.cache.set(cacheKey, metadata);
    
    // Auto-clear cache after 1 hour
    setTimeout(() => this.cache.delete(cacheKey), 3600000);

    return metadata;
  }

  /**
   * Get searchable fields for an entity (public API)
   */
  getSearchableFields<T>(entityClass: new () => T): SearchableFieldMetadata[] {
    return this.getSearchableFieldMetadata(entityClass);
  }

  /**
   * Get filterable fields for an entity (public API)
   */
  getFilterableFields<T>(entityClass: new () => T): FilterableFieldMetadata[] {
    return this.getFilterableFieldMetadata(entityClass);
  }

  /**
   * Get sortable fields for an entity (public API)
   */
  getSortableFields<T>(entityClass: new () => T): SortableFieldMetadata[] {
    return this.getSortableFieldMetadata(entityClass);
  }

  /**
   * Get searchable fields from @Searchable decorator
   * Returns full metadata including weight, behavior, and description
   */
  private getSearchableFieldMetadata<T>(entityClass: new () => T): SearchableFieldMetadata[] {
    try {
      const config = getSearchableFieldsConfig(entityClass);
      
      return Array.from(config.entries()).map(([field, options]) => {
        const type = options.type || 'string';
        const weight = options.weight ?? 5; // Default weight
        const behavior = options.behavior || this.inferBehavior(type);
        
        return {
          field,
          type,
          weight,
          behavior,
          description: options.description,
          examples: this.getSearchExamples(type, behavior),
        };
      });
    } catch {
      // Fallback to simple field list
      const fields = getSearchableFields(entityClass);
      return fields.map((field) => ({
        field,
        type: 'string',
        weight: 5,
        behavior: 'partial',
        examples: ['example search term'],
      }));
    }
  }

  /**
   * Infer search behavior from field type
   */
  private inferBehavior(type: string): string {
    switch (type) {
      case 'integer':
      case 'numeric':
      case 'decimal':
        return 'range';
      case 'date':
      case 'datetime':
        return 'range';
      case 'boolean':
        return 'exact';
      default:
        return 'partial';
    }
  }

  /**
   * Get filterable fields from @Filterable decorator
   */
  private getFilterableFieldMetadata<T>(entityClass: new () => T): FilterableFieldMetadata[] {
    const fields = getFilterableFields(entityClass);
    
    return fields.map((field) => {
      const columnType = this.getColumnType(entityClass, field);
      return {
        field,
        type: columnType,
        description: this.getFieldDescription(field),
        examples: this.getFilterExamples(field, columnType),
      };
    });
  }

  /**
   * Get sortable fields from @Sortable decorator
   */
  private getSortableFieldMetadata<T>(entityClass: new () => T): SortableFieldMetadata[] {
    const fields = getSortableFields(entityClass);
    
    return fields.map((field) => ({
      field,
      type: 'sortable',
      examples: [`${field}:ASC`, `${field}:DESC`],
    }));
  }

  /**
   * Get column type from TypeORM metadata
   */
  private getColumnType<T>(entityClass: new () => T, field: string): string {
    try {
      const metadata = this.dataSource.getMetadata(entityClass);
      const column = metadata.columns.find((col) => col.propertyName === field);
      return column ? String(column.type) : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get search examples by field type and behavior
   */
  private getSearchExamples(type: string, behavior?: string): string[] {
    // For range behavior, show range examples
    if (behavior === 'range') {
      switch (type) {
        case 'integer':
        case 'numeric':
        case 'decimal':
          return ['123', '100-500', '>100', '<1000'];
        case 'date':
        case 'datetime':
          return ['2024', '2024-01', '2024-01-15', '>2024-01-01'];
        default:
          return ['example', 'search term'];
      }
    }
    
    // For exact match behavior
    if (behavior === 'exact') {
      switch (type) {
        case 'integer':
        case 'numeric':
          return ['123', '456'];
        case 'boolean':
          return ['true', 'false'];
        default:
          return ['exact value', 'US', 'CA'];
      }
    }
    
    // Default partial/prefix/suffix behavior
    switch (type) {
      case 'integer':
      case 'numeric':
        return ['123', '100-500'];
      case 'date':
      case 'datetime':
        return ['2024', '2024-01', '2024-01-15'];
      case 'boolean':
        return ['true', 'false'];
      default:
        return ['example', 'search term', 'partial match'];
    }
  }

  /**
   * Get filter examples by column type
   */
  private getFilterExamples(field: string, columnType: string): string[] {
    const type = columnType.toLowerCase();
    
    if (type.includes('int') || type.includes('numeric')) {
      return [
        `${field}:eq:100`,
        `${field}:gte:50`,
        `${field}:lte:1000`,
      ];
    }
    
    if (type.includes('bool')) {
      return [`${field}:eq:true`, `${field}:eq:false`];
    }
    
    if (type.includes('date') || type.includes('timestamp')) {
      return [
        `${field}:gte:2024-01-01`,
        `${field}:lte:2024-12-31`,
      ];
    }
    
    // String types
    return [
      `${field}:eq:value`,
      `${field}:contains:text`,
    ];
  }

  /**
   * Build example URLs
   */
  private buildExamples(
    entityName: string,
    baseUrl: string,
    searchable: SearchableFieldMetadata[],
    filterable: FilterableFieldMetadata[],
    sortable: SortableFieldMetadata[],
  ): EntityMetadataResponse['examples'] {
    const searchField = searchable[0]?.field || 'name';
    const filterField = filterable[0]?.field || 'id';
    const sortField = sortable[0]?.field || 'name';

    return {
      search: `${baseUrl}/${entityName}?search=example`,
      filter: `${baseUrl}/${entityName}?filter=${filterField}:eq:1`,
      sort: `${baseUrl}/${entityName}?sort=${sortField}:ASC`,
      combined: `${baseUrl}/${entityName}?search=example&filter=${filterField}:gte:1&sort=${sortField}:DESC&limit=25&offset=0`,
    };
  }

  /**
   * Get entity description
   */
  private getEntityDescription(entityName: string): string {
    const descriptions: Record<string, string> = {
      countries: 'Country reference data with ISO codes',
      companies: 'Company/brokerage information',
      regions: 'Geographic regions within countries',
      states: 'State/province data with programs',
    };

    return descriptions[entityName] || `${entityName} entity`;
  }

  /**
   * Get field description
   */
  private getFieldDescription(field: string): string | undefined {
    const descriptions: Record<string, string> = {
      id: 'Unique identifier',
      name: 'Display name',
      code: 'Short code identifier',
      alpha2: 'ISO 3166-1 alpha-2 code',
      alpha3: 'ISO 3166-1 alpha-3 code',
      number: 'ISO 3166-1 numeric code',
      dialingCode: 'International dialing code',
      created: 'Creation timestamp',
      lastModified: 'Last modification timestamp',
    };

    return descriptions[field];
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
