import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateEntity, CountryProgramEntity, ProgramEntity, CountryEntity } from '@exprealty/database';
import { StatesController } from './states.controller.js';
import { StatesService } from './states.service.js';
import { StatesTypeOrmRepository } from './states.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';

/**
 * Module for State aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - StatesService depends on IStatesRepository PORT
 * - StatesTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 * 
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 */
@Module({
	imports: [
		// Register all entities involved in relationships for proper TypeORM metadata resolution
		TypeOrmModule.forFeature([StateEntity, CountryProgramEntity, ProgramEntity, CountryEntity]),
		PaginationModule,
	],
	controllers: [StatesController],
	providers: [
		StatesService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'IStatesRepository',
			useClass: StatesTypeOrmRepository,
		},
	],
	exports: [
		StatesService,
		// Export repository token for use in other modules
		{
			provide: 'IStatesRepository',
			useClass: StatesTypeOrmRepository,
		},
	],
})
export class StatesModule {}
