import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Entity Registry
 * 
 * Manages all registered entities for metadata introspection
 * Automatically discovers entities from TypeORM DataSource
 */
@Injectable()
export class EntityRegistry implements OnModuleInit {
  private readonly entities = new Map<string, new () => any>();
  private readonly entityMetadata = new Map<string, EntityMetadataInfo>();

  constructor(private readonly dataSource: DataSource, private readonly logger: LoggerService, private readonly moduleRef: ModuleRef) {
    this.logger.setContext('EntityRegistry');
  }

  /**
   * Auto-discover entities from TypeORM on module init
   */
  onModuleInit() {
    const metadata = this.dataSource.entityMetadatas;
    
    metadata.forEach((meta) => {
      const entityName = meta.tableName
        .replace(/^.*\./, '') // Remove schema prefix
        .replace(/_/g, '-'); // snake_case → kebab-case

      this.entities.set(entityName, meta.target as new () => any);

      this.entityMetadata.set(entityName, {
        name: entityName,
        tableName: meta.tableName,
        className: meta.targetName,
        schema: meta.schema,
        primaryColumns: meta.primaryColumns.map((col) => col.propertyName),
        columnCount: meta.columns.length,
        relationCount: meta.relations.length,
      });

      this.logger.debug('Registered entity', {
        name: entityName,
        tableName: meta.tableName,
        className: meta.targetName,
      });
    });

    this.logger.info('Entity registry initialized', {
      totalEntities: this.entities.size,
    });
  }

  /**
   * Manually register an entity
   */
  register(name: string, entityClass: new () => any): void {
    const normalizedName = name.toLowerCase().replace(/_/g, '-');
    this.entities.set(normalizedName, entityClass);
    this.logger.debug('Manually registered entity', { name: normalizedName });
  }

  /**
   * Get entity class by name
   */
  get(name: string): (new () => any) | undefined {
    const normalizedName = name.toLowerCase().replace(/_/g, '-');
    return this.entities.get(normalizedName);
  }

  /**
   * Get entity class or throw error
   */
  getOrFail(name: string): new () => any {
    const entity = this.get(name);
    
    if (!entity) {
      const available = Array.from(this.entities.keys());
      throw new Error(
        `Entity '${name}' not found. Available entities: ${available.join(', ')}`,
      );
    }

    return entity;
  }

  /**
   * Check if entity exists
   */
  has(name: string): boolean {
    const normalizedName = name.toLowerCase().replace(/_/g, '-');
    return this.entities.has(normalizedName);
  }

  /**
   * Get all registered entities
   */
  getAll(): Array<EntityMetadataInfo> {
    return Array.from(this.entityMetadata.values());
  }

  /**
   * Get entity names
   */
  getNames(): string[] {
    return Array.from(this.entities.keys());
  }
}

/**
 * Entity metadata info
 */
export interface EntityMetadataInfo {
  name: string;
  tableName: string;
  className: string;
  schema?: string;
  primaryColumns: string[];
  columnCount: number;
  relationCount: number;
}