import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateEntity, StateProgramEntity, ProgramEntity, CountryEntity } from '@exprealty/database';
import { StatesController } from './states.controller.js';
import { StatesService } from './states.service.js';
import { StatesTypeOrmRepository } from './states.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { QueryService } from '../../common/query/query.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';

/**
 * Module for State aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - StatesService depends on IStatesRepository PORT
 * - StatesTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 */
@Module({
	imports: [
		// Register all entities involved in relationships for proper TypeORM metadata resolution
		TypeOrmModule.forFeature([StateEntity, StateProgramEntity, ProgramEntity, CountryEntity]),
		PaginationModule,
	],
	controllers: [StatesController],
	providers: [
		StatesService,
		QueryService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'IStatesRepository',
			useClass: StatesTypeOrmRepository,
		},
	],
	exports: [StatesService],
})
export class StatesModule {}
