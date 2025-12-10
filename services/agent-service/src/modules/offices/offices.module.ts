import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
	OfficeEntity, 
	CompanyEntity,
	AgentOfficeEntity,
	AgentEntity,
	OfficeExternalReferenceEntity,
	ExternalReferenceEntity,
	AgentExternalReferenceEntity,
	CompanyExternalReferenceEntity,
} from '@exprealty/database';
import { OfficesController } from './offices.controller.js';
import { OfficesService } from './offices.service.js';
import { OfficesTypeOrmRepository } from './offices.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';

/**
 * Module for Office aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - OfficesService depends on IOfficesRepository PORT
 * - OfficesTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 * 
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 * 
 * Entity Registration (full graph for TypeORM metadata resolution):
 * - OfficeEntity: Main entity for this module
 * - CompanyEntity: Required for ManyToOne company relation
 * - AgentOfficeEntity: Junction table for Office-Agent relation
 * - AgentEntity: Required by AgentOfficeEntity ManyToOne
 * - OfficeExternalReferenceEntity: Junction table for Office-ExternalReference
 * - ExternalReferenceEntity: Required by OfficeExternalReferenceEntity ManyToOne
 * - AgentExternalReferenceEntity: Required by ExternalReferenceEntity OneToMany
 * - CompanyExternalReferenceEntity: Required by ExternalReferenceEntity OneToMany
 */
@Module({
	imports: [
		// Register OfficeEntity and full entity graph for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			OfficeEntity,
			CompanyEntity,
			AgentOfficeEntity,
			AgentEntity,
			OfficeExternalReferenceEntity,
			ExternalReferenceEntity,
			AgentExternalReferenceEntity,
			CompanyExternalReferenceEntity,
		]),
		PaginationModule,
	],
	controllers: [OfficesController],
	providers: [
		OfficesService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'IOfficesRepository',
			useClass: OfficesTypeOrmRepository,
		},
	],
	exports: [OfficesService],
})
export class OfficesModule {}
