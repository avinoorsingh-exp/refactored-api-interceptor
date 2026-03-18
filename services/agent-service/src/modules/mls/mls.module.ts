import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
	MLSEntity, 
	AddressEntity,
	AgentMLSEntity,
	AgentEntity,
} from '@exprealty/database';
import { MLSController } from './mls.controller.js';
import { MLSService } from './mls.service.js';
import { MLSTypeOrmRepository } from './mls.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';

/**
 * Module for MLS aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - MLSService depends on IMLSRepository PORT
 * - MLSTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 * 
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 * 
 * Entity Registration (full graph for TypeORM metadata resolution):
 * - MLSEntity: Main entity for this module
 * - AddressEntity: Required for ManyToOne address relation
 * - AgentMLSEntity: Junction table for MLS-Agent relation
 * - AgentEntity: Required by AgentMLSEntity ManyToOne
 */
@Module({
	imports: [
		// Register MLSEntity and full entity graph for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			MLSEntity,
			AddressEntity,
			AgentMLSEntity,
			AgentEntity,
		]),
		PaginationModule,
	],
	controllers: [MLSController],
	providers: [
		MLSService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'IMLSRepository',
			useClass: MLSTypeOrmRepository,
		},
	],
	exports: [MLSService],
})
export class MLSModule {}
