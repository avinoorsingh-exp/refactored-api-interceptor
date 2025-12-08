
import { Injectable } from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Resolves TypeScript property names to database column names
 * Uses TypeORM's metadata to ensure correct mapping
 */
@Injectable()
export class ColumnResolverService {

  constructor(private readonly dataSource: DataSource, private readonly logger: LoggerService) {
    this.logger.setContext('ColumnResolverService');
  }

  /**
   * Get database column name from TypeScript property name
   * 
   * @param entityClass - Entity class (e.g., ListingEntity)
   * @param propertyName - TypeScript property name (e.g., 'listPrice')
   * @returns Database column name (e.g., 'list_price')
   */
  getColumnName<T>(entityClass: new () => T, propertyName: string): string {
    const metadata = this.getMetadata(entityClass);
    
    // Find the column by property name
    const column = metadata.columns.find(
      (col) => col.propertyName === propertyName,
    );

    if (!column) {
      this.logger.warn('Column not found for property', {
        entity: metadata.tableName,
        propertyName,
      });
      // Fallback: assume property name matches column name
      return propertyName;
    }

    return column.databaseName;
  }

  /**
   * Get database column name with alias prefix
   * 
   * @param entityClass - Entity class
   * @param alias - Query builder alias
   * @param propertyName - TypeScript property name
   * @returns Aliased column name (e.g., 'listing.list_price')
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
   * 
   * @param entityClass - Entity class
   * @param propertyName - TypeScript property name
   * @returns Column type (e.g., 'numeric', 'varchar', 'timestamp')
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

    return column.type as string;
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
   * Returns map of propertyName -> columnName
   */
  getColumnMappings<T>(entityClass: new () => T): Map<string, string> {
    const metadata = this.getMetadata(entityClass);
    const mappings = new Map<string, string>();

    metadata.columns.forEach((column) => {
      mappings.set(column.propertyName, column.databaseName);
    });

    return mappings;
  }

  /**
   * Get entity metadata
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
}