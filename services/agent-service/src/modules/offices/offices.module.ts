import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
	OfficeEntity, 
	CompanyEntity,
	AgentOfficeEntity,
	OfficeExternalReferenceEntity,
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
 * Entity Registration Chain (TypeORM requires all related entities):
 * OfficeEntity → CompanyEntity
 *              → AgentOfficeEntity
 *              → OfficeExternalReferenceEntity
 */
@Module({
	imports: [
		// Register OfficeEntity and all related entities for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			OfficeEntity,
			CompanyEntity,
			AgentOfficeEntity,
			OfficeExternalReferenceEntity,
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
