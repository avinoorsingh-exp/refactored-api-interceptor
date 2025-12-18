
import { Injectable } from '@nestjs/common';
import { DataSource, EntityMetadata, SelectQueryBuilder } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Column Resolver Service
 * 
 * ✅ Resolves column names with proper aliases
 * ✅ Detects column types and applies casting
 * ✅ Handles UUID, BigInt, and other special types
 */
@Injectable()
export class ColumnResolverService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('ColumnResolverService');
  }

  /**
   * Resolve column with type casting for query operations
   * Returns: "alias.column::cast" or "alias.column"
   */
  resolveColumn<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    columnName: string,
    operation: 'select' | 'filter' | 'sort' | 'search' = 'select',
  ): string {
    // Handle relation fields (e.g., "office.name")
    if (columnName.includes('.')) {
      return this.resolveRelationColumn(qb, columnName, operation);
    }

    // Get entity metadata from query builder
    const metadata = this.getEntityMetadataFromQb(qb, alias);
    if (!metadata) {
      this.logger.warn('Entity metadata not found', { alias, columnName });
      return `${alias}.${this.toSnakeCase(columnName)}`;
    }

    // Find column metadata
    const column = metadata.columns.find(
      (col) =>
        col.propertyName === columnName ||
        col.databaseName === columnName ||
        col.databaseName === this.toSnakeCase(columnName),
    );

    if (!column) {
      this.logger.warn('Column not found in metadata', { alias, columnName });
      return `${alias}.${this.toSnakeCase(columnName)}`;
    }

    const dbColumnName = column.databaseName;
    const columnType = this.getColumnTypeFromMetadata(column);
    const fullColumnPath = `${alias}.${dbColumnName}`;

    // Apply type casting based on operation
    return this.applyCastingForOperation(fullColumnPath, columnType, operation);
  }

  /**
   * Apply casting for filter operator
   * Returns the column expression with appropriate cast for the operator
   */
  applyCastingForFilterOperator(
    columnPath: string,
    columnType: string,
    operator: string,
    value: any,
  ): { column: string; needsCast: boolean } {
    const lowerType = columnType.toLowerCase();
    const lowerOperator = operator.toLowerCase();

    // Text search operators on non-text types need CAST
    if (
      lowerOperator === 'contains' ||
      lowerOperator === 'startswith' ||
      lowerOperator === 'endswith' ||
      lowerOperator === 'like' ||
      lowerOperator === 'ilike'
    ) {
      // UUID, numbers, dates need text casting for LIKE operations
      if (this.needsTextCast(lowerType)) {
        return {
          column: `${columnPath}::text`,
          needsCast: true,
        };
      }
    }

    // Numeric operators on text types (if value is numeric)
    if (
      (lowerOperator === 'gt' ||
        lowerOperator === 'gte' ||
        lowerOperator === 'lt' ||
        lowerOperator === 'lte') &&
      (lowerType.includes('varchar') || lowerType.includes('text'))
    ) {
      if (typeof value === 'number' || !isNaN(Number(value))) {
        return {
          column: `${columnPath}::numeric`,
          needsCast: true,
        };
      }
    }

    // UUID exact match - keep as UUID if valid
    if (lowerType.includes('uuid') && lowerOperator === 'eq') {
      if (this.isValidUUID(value)) {
        return { column: columnPath, needsCast: false };
      } else {
        // Invalid UUID - cast to text for comparison
        return { column: `${columnPath}::text`, needsCast: true };
      }
    }

    // No casting needed
    return { column: columnPath, needsCast: false };
  }

  /**
   * Get column type from query builder for a specific field
   */
  getColumnTypeFromQb<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    propertyName: string,
  ): string {
    const metadata = this.getEntityMetadataFromQb(qb, alias);
    if (!metadata) return 'unknown';

    const column = metadata.columns.find(
      (col) => col.propertyName === propertyName,
    );

    if (!column) return 'unknown';

    return this.getColumnTypeFromMetadata(column);
  }

  /**
   * Get database column name from TypeScript property name
   */
  getColumnName<T>(entityClass: new () => T, propertyName: string): string {
    const metadata = this.getMetadata(entityClass);

    const column = metadata.columns.find(
      (col) => col.propertyName === propertyName,
    );

    if (!column) {
      this.logger.warn('Column not found for property', {
        entity: metadata.tableName,
        propertyName,
      });
      return propertyName;
    }

    return column.databaseName;
  }

  /**
   * Get database column name with alias prefix
   */
  getAliasedColumnName<T>(
    entityClass: new () => T,
    alias: string,
    propertyName: string,
  ): string {
    const columnName = this.getColumnName(entityClass, propertyName);
    return `${alias}.${columnName}`;
  }

  /**
   * Get column type from property name
   */
  getColumnType<T>(entityClass: new () => T, propertyName: string): string {
    const metadata = this.getMetadata(entityClass);

    const column = metadata.columns.find(
      (col) => col.propertyName === propertyName,
    );

    if (!column) {
      this.logger.warn('Column not found for property', {
        entity: metadata.tableName,
        propertyName,
      });
      return 'unknown';
    }

    return this.getColumnTypeFromMetadata(column);
  }

  /**
   * Check if a property exists on the entity
   */
  hasProperty<T>(entityClass: new () => T, propertyName: string): boolean {
    const metadata = this.getMetadata(entityClass);
    return metadata.columns.some((col) => col.propertyName === propertyName);
  }

  /**
   * Get all column mappings for an entity
   */
  getColumnMappings<T>(entityClass: new () => T): Map<string, string> {
    const metadata = this.getMetadata(entityClass);
    const mappings = new Map<string, string>();

    metadata.columns.forEach((column) => {
      mappings.set(column.propertyName, column.databaseName);
    });

    return mappings;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Apply type casting based on column type and operation
   */
  private applyCastingForOperation(
    columnPath: string,
    columnType: string,
    operation: 'select' | 'filter' | 'sort' | 'search',
  ): string {
    switch (operation) {
      case 'search':
        // Search operations need text casting for non-text types
        return this.applyTextCast(columnPath, columnType);

      case 'filter':
        // Filter casting is handled per-operator in applyCastingForFilterOperator
        return columnPath;

      case 'sort':
      case 'select':
      default:
        return columnPath;
    }
  }

  /**
   * Apply text cast for search operations
   */
  private applyTextCast(columnPath: string, columnType: string): string {
    if (this.needsTextCast(columnType.toLowerCase())) {
      return `${columnPath}::text`;
    }
    return columnPath;
  }

  /**
   * Check if column type needs text casting for LIKE/ILIKE
   */
  private needsTextCast(columnType: string): boolean {
    const nonTextTypes = [
      'uuid',
      'bigint',
      'int',
      'integer',
      'smallint',
      'decimal',
      'numeric',
      'real',
      'double precision',
      'money',
      'boolean',
      'date',
      'timestamp',
      'timestamp with time zone',
      'timestamp without time zone',
    ];

    return nonTextTypes.some((type) => columnType.includes(type));
  }

  /**
   * Get column type from TypeORM column metadata
   */
  private getColumnTypeFromMetadata(column: any): string {
    if (column.type) {
      if (typeof column.type === 'string') {
        return column.type;
      }
      if (typeof column.type === 'function') {
        return column.type.name.toLowerCase();
      }
    }

    if (column.databaseType) {
      return column.databaseType;
    }

    return 'varchar';
  }

  /**
   * Get entity metadata from query builder
   */
  private getEntityMetadataFromQb<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): EntityMetadata | undefined {
    const aliasMap = qb.expressionMap.aliases.find((a) => a.name === alias);
    return aliasMap?.metadata;
  }

  /**
   * Get entity metadata from DataSource
   */
  private getMetadata<T>(entityClass: new () => T): EntityMetadata {
    try {
      return this.dataSource.getMetadata(entityClass);
    } catch (error) {
      throw new Error(
        `Failed to get metadata for entity: ${entityClass.name}. ` +
          `Ensure the entity is registered with TypeORM.`,
      );
    }
  }

  /**
   * Resolve relation column (e.g., "office.name")
   */
  private resolveRelationColumn<T>(
    qb: SelectQueryBuilder<T>,
    columnPath: string,
    operation: 'select' | 'filter' | 'sort' | 'search',
  ): string {
    const [relationAlias, columnName] = columnPath.split('.');

    const metadata = this.getEntityMetadataFromQb(qb, relationAlias);
    if (!metadata) {
      this.logger.warn('Relation metadata not found', { relationAlias });
      return `${relationAlias}.${this.toSnakeCase(columnName)}`;
    }

    const column = metadata.columns.find(
      (col) =>
        col.propertyName === columnName ||
        col.databaseName === columnName ||
        col.databaseName === this.toSnakeCase(columnName),
    );

    if (!column) {
      return `${relationAlias}.${this.toSnakeCase(columnName)}`;
    }

    const dbColumnName = column.databaseName;
    const columnType = this.getColumnTypeFromMetadata(column);
    const fullPath = `${relationAlias}.${dbColumnName}`;

    return this.applyCastingForOperation(fullPath, columnType, operation);
  }

  /**
   * Check if value is valid UUID format
   */
  private isValidUUID(value: any): boolean {
    if (typeof value !== 'string') return false;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Get PostgreSQL type for value
   */
  getPostgresType(value: any): string {
    if (value === null || value === undefined) return 'text';

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'bigint' : 'numeric';
    }

    if (typeof value === 'boolean') return 'boolean';

    if (value instanceof Date) return 'timestamp';

    if (typeof value === 'string') {
      if (this.isValidUUID(value)) return 'uuid';
      if (!isNaN(Number(value)) && value.trim() !== '') return 'numeric';
      return 'text';
    }

    return 'text';
  }
}