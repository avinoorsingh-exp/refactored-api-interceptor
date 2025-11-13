import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RegionEntity } from '@exprealty/database'
import { RegionsController } from './regions.controller.js'
import { RegionsService } from './regions.service.js'
import { RegionsTypeOrmRepository } from './regions.repository.js'
import { PaginationModule } from '../../common/pagination/pagination.module.js'

/**
 * Module for Region aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - RegionsService depends on IRegionsRepository PORT
 * - RegionsTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 */
@Module({
	imports: [TypeOrmModule.forFeature([RegionEntity]), PaginationModule],
	controllers: [RegionsController],
	providers: [
		RegionsService,
		// Provide the repository adapter under the port token
		{
			provide: 'IRegionsRepository',
			useClass: RegionsTypeOrmRepository,
		},
	],
	exports: [RegionsService],
})
export class RegionsModule {}
