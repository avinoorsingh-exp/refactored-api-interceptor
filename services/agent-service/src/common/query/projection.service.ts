
import { Injectable, BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionConfig, FieldSelection } from '@exprealty/shared-domain';

@Injectable()
export class ProjectionService {
  constructor(private readonly logger: LoggerService) {
  }

  /**
   * Apply field projection to TypeORM QueryBuilder
   * Selects only requested fields at database level
   */
  applyProjection<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    selection: FieldSelection | undefined,
    config: ProjectionConfig,
  ): void {
    if (!selection?.fields) {
      // No projection - use defaults
      this.applyDefaultProjection(qb, alias, config);
      return;
    }

    const requestedFields = selection.fields;

    // Validate requested fields
    const invalidFields = requestedFields.filter(
      (field) => !config.allowed.includes(field) && !config.required.includes(field),
    );

    if (invalidFields.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Invalid fields requested: ${invalidFields.join(', ')}`,
        error: 'Bad Request',
        allowedFields: config.allowed,
      });
    }

    // Always include required fields (primary keys, etc.)
    const fieldsToSelect = [...new Set([...config.required, ...requestedFields])];

    this.logger.debug('Applying projection', {
      alias,
      requestedFields,
      fieldsToSelect,
    });

    // Apply TypeORM select
    qb.select(fieldsToSelect.map((field) => `${alias}.${field}`));
  }

  /**
   * Apply default projection (when no ?fields specified)
   */
  private applyDefaultProjection<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    config: ProjectionConfig,
  ): void {
    if (config.default.length > 0) {
      qb.select(config.default.map((field) => `${alias}.${field}`));
    }
    // If no default specified, TypeORM selects all columns
  }

  /**
   * Apply relation loading based on ?include
   * Uses leftJoin() + addSelect() for specific fields instead of leftJoinAndSelect()
   * This allows field projection to work alongside relation loading.
   */
  applyRelations<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    selection: FieldSelection | undefined,
    config: ProjectionConfig,
  ): void {
    if (!selection?.include) {
      return;
    }

    const requestedRelations = selection.include;

    // Validate requested relations
    const invalidRelations = requestedRelations.filter(
      (rel) => !config.relations[rel],
    );

    if (invalidRelations.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Invalid relations requested: ${invalidRelations.join(', ')}`,
        error: 'Bad Request',
        availableRelations: Object.keys(config.relations),
      });
    }

    // Load each relation with specific fields
    for (const relationName of requestedRelations) {
      const relationConfig = config.relations[relationName];

      // Skip virtual relations - they are loaded by the repository via custom methods
      // (e.g., primaryEmail, primaryPhone loaded via loadPrimaryContacts())
      if (relationConfig.virtual) {
        this.logger.debug('Skipping virtual relation (handled by repository)', {
          relationName,
        });
        continue;
      }

      const relationAlias = `${alias}_${relationName}`;

      this.logger.debug('Loading relation', {
        alias,
        relationName,
        relationAlias,
        fields: relationConfig.fields,
      });

      // Use leftJoin (not leftJoinAndSelect) to avoid selecting all fields
      qb.leftJoin(
        `${alias}.${relationConfig.property}`,
        relationAlias,
      );

      // Add specific fields from the relation config
      if (relationConfig.fields && relationConfig.fields.length > 0) {
        for (const field of relationConfig.fields) {
          qb.addSelect(`${relationAlias}.${field}`);
        }
      }

      // Load nested relations if configured
      if (relationConfig.nested && relationConfig.nested.length > 0) {
        for (const nestedRelation of relationConfig.nested) {
          const nestedAlias = `${relationAlias}_${nestedRelation}`;
          this.logger.debug('Loading nested relation', {
            parentAlias: relationAlias,
            nestedRelation,
            nestedAlias,
          });

          // Use leftJoin for nested too
          qb.leftJoin(
            `${relationAlias}.${nestedRelation}`,
            nestedAlias,
          );

          // Select all fields from nested relation using leftJoinAndSelect behavior
          // This ensures the nested entity data is included in the result
          qb.addSelect(nestedAlias);
        }
      }
    }
  }

  /**
   * Get allowed fields for an entity
   */
  getAllowedFields(config: ProjectionConfig): string[] {
    return [...config.required, ...config.allowed];
  }

  /**
   * Get available relations for an entity
   */
  getAvailableRelations(config: ProjectionConfig): string[] {
    return Object.keys(config.relations);
  }
}