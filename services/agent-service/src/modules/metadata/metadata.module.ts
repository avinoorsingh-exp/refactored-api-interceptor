import { Module, Global } from '@nestjs/common';
import {
  CountryEntity,
  CompanyEntity,
  RegionEntity,
  StateEntity,
  OfficeEntity,
} from '@exprealty/database';
import { MetadataService } from './metadata.service.js';
import { MetadataController } from './metadata.controller.js';
import { EntityRegistry } from '../../common/database/entity-registry.service.js';

/**
 * Metadata Module
 * 
 * Provides entity metadata for dynamic UI builders.
 * Auto-discovers entities from TypeORM and exposes their
 * searchable, filterable, and sortable fields.
 * 
 * Endpoints:
 * - GET /v1/:entity/metadata - Complete metadata for entity
 * - GET /v1/metadata/entities - List all available entities
 */
@Global()
@Module({
  controllers: [MetadataController],
  providers: [
    EntityRegistry,
    MetadataService,
    {
      provide: 'ENTITY_REGISTRY_INIT',
      useFactory: (registry: EntityRegistry) => {
        // Register entities with URL-friendly names
        registry.register('countries', CountryEntity);
        registry.register('companies', CompanyEntity);
        registry.register('regions', RegionEntity);
        registry.register('states', StateEntity);
        registry.register('offices', OfficeEntity);
        return registry;
      },
      inject: [EntityRegistry],
    },
  ],
  exports: [MetadataService, EntityRegistry],
})
export class MetadataModule {}