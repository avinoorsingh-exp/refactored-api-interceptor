
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';
import { 
  getSearchableFieldsConfig, 
  SearchableOptions,
  SearchableFieldType,
  SearchableFieldConfig,
  SearchValidators,
} from '@exprealty/database';

/**
 * Reads @Searchable decorator metadata and TypeORM column metadata
 * to generate SearchableFieldConfig[] automatically
 */
@Injectable()
export class SearchMetadataReader {
  private readonly configCache = new Map<Function, SearchableFieldConfig[]>();

  constructor(private readonly dataSource: DataSource, private readonly logger: LoggerService) {
    this.logger.setContext('SearchMetadataReader');
  }

  /**
   * Get searchable field configuration for an entity
   * Combines @Searchable decorator options with TypeORM column metadata
   * 
   * @param entityClass - Entity class
   * @returns Array of searchable field configurations
   */
  getSearchableFieldsConfig<T>(entityClass: new () => T): SearchableFieldConfig[] {
    // Check cache first
    if (this.configCache.has(entityClass)) {
      return this.configCache.get(entityClass)!;
    }

    // Get @Searchable metadata (Map of field -> options)
    const searchableFieldsMap = getSearchableFieldsConfig(entityClass);

    if (searchableFieldsMap.size === 0) {
      this.logger.debug('No @Searchable fields found', {
        entity: entityClass.name,
      });
      return [];
    }

    // Get TypeORM metadata
    const entityMetadata = this.dataSource.getMetadata(entityClass);

    const configs: SearchableFieldConfig[] = [];

    // Build configuration for each searchable field
    searchableFieldsMap.forEach((options: SearchableOptions, propertyKey: string) => {
      const propertyName = String(propertyKey);

      // Find TypeORM column metadata
      const column = entityMetadata.columns.find(
        (col) => col.propertyName === propertyName,
      );

      if (!column) {
        this.logger.warn('Searchable property has no @Column decorator', {
          entity: entityClass.name,
          property: propertyName,
        });
        return;
      }

      // Infer search field type from TypeORM column type
      const fieldType = options.type
        ? this.mapStringToFieldType(options.type)
        : this.inferFieldTypeFromColumn(column.type as string, column.propertyName);

      // Auto-assign validator based on type if not provided
      const validate = options.validate ?? this.getDefaultValidator(fieldType, column.type as string);

      const config: SearchableFieldConfig = {
        field: propertyName,
        type: fieldType,
        weight: options.weight || 5, // Default weight
        searchBehavior: options.behavior,
        validate,
      };

      configs.push(config);

      this.logger.debug('Registered searchable field', {
        entity: entityClass.name,
        field: propertyName,
        columnName: column.databaseName,
        columnType: column.type,
        inferredType: fieldType,
        weight: config.weight,
      });
    });

    // Sort by weight (descending) for better relevance
    configs.sort((a, b) => (b.weight || 5) - (a.weight || 5));

    // Cache the result
    this.configCache.set(entityClass, configs);

    return configs;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Infer SearchableFieldType from TypeORM column type
   */
  private inferFieldTypeFromColumn(
    columnType: string,
    propertyName: string,
  ): SearchableFieldType {
    const typeStr = String(columnType).toLowerCase();

    // String types
    if (
      typeStr.includes('varchar') ||
      typeStr.includes('char') ||
      typeStr.includes('string')
    ) {
      return SearchableFieldType.STRING;
    }

    // Text types
    if (typeStr.includes('text')) {
      return SearchableFieldType.TEXT;
    }

    // Numeric types
    if (
      typeStr.includes('numeric') ||
      typeStr.includes('decimal') ||
      typeStr.includes('money')
    ) {
      return SearchableFieldType.DECIMAL;
    }

    // Integer types
    if (
      typeStr.includes('int') ||
      typeStr.includes('serial') ||
      typeStr.includes('bigint') ||
      typeStr.includes('smallint')
    ) {
      return SearchableFieldType.INTEGER;
    }

    // Date types
    if (typeStr.includes('date') && !typeStr.includes('time')) {
      return SearchableFieldType.DATE;
    }

    // DateTime types
    if (
      typeStr.includes('timestamp') ||
      typeStr.includes('datetime') ||
      (typeStr.includes('date') && typeStr.includes('time'))
    ) {
      return SearchableFieldType.DATETIME;
    }

    // Boolean types
    if (typeStr.includes('bool')) {
      return SearchableFieldType.BOOLEAN;
    }

    // Enum types
    if (typeStr.includes('enum')) {
      return SearchableFieldType.ENUM;
    }

    // Default fallback
    this.logger.warn('Unknown column type, defaulting to STRING', {
      columnType,
      propertyName,
    });

    return SearchableFieldType.STRING;
  }

  /**
   * Map string type to SearchableFieldType enum
   */
  private mapStringToFieldType(type: string): SearchableFieldType {
    const typeMap: Record<string, SearchableFieldType> = {
      string: SearchableFieldType.STRING,
      text: SearchableFieldType.TEXT,
      numeric: SearchableFieldType.NUMERIC,
      integer: SearchableFieldType.INTEGER,
      decimal: SearchableFieldType.DECIMAL,
      date: SearchableFieldType.DATE,
      datetime: SearchableFieldType.DATETIME,
      boolean: SearchableFieldType.BOOLEAN,
    };

    return typeMap[type.toLowerCase()] || SearchableFieldType.STRING;
  }

  /**
   * Get default validator based on field type and column type
   * Automatically assigns range validators for integer/bigint columns
   */
  private getDefaultValidator(
    fieldType: SearchableFieldType,
    columnType: string,
  ): ((value: any, field: string, fieldType: string) => { valid: boolean; error?: string; sanitized?: any }) | undefined {
    const typeStr = String(columnType).toLowerCase();

    // Integer types get integer range validator
    if (fieldType === SearchableFieldType.INTEGER) {
      if (typeStr.includes('bigint')) {
        return SearchValidators.bigint;
      }
      if (typeStr.includes('int') && !typeStr.includes('bigint')) {
        return SearchValidators.integer;
      }
    }

    // Numeric/decimal types don't need range validation (very large range)
    return undefined;
  }
}