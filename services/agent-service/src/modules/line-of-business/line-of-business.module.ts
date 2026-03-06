import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LineOfBusinessEntity } from '@exprealty/database'
import { PaginationModule } from '../../common/pagination/pagination.module.js'
import { ProjectionService } from '../../common/query/projection.service.js'
import { LineOfBusinessController } from './line-of-business.controller.js'
import { LineOfBusinessService } from './line-of-business.service.js'
import { LineOfBusinessTypeOrmRepository } from './line-of-business.repository.js'

/**
 * Module for LineOfBusiness aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - LineOfBusinessService depends on ILineOfBusinessRepository PORT
 * - LineOfBusinessTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 *
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 */
@Module({
	imports: [TypeOrmModule.forFeature([LineOfBusinessEntity]), PaginationModule],
	controllers: [LineOfBusinessController],
	providers: [
		LineOfBusinessService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'ILineOfBusinessRepository',
			useClass: LineOfBusinessTypeOrmRepository,
		},
	],
	exports: [
		LineOfBusinessService,
		// Export repository token for use in other modules (e.g., license module)
		{
			provide: 'ILineOfBusinessRepository',
			useClass: LineOfBusinessTypeOrmRepository,
		},
	],
})
export class LineOfBusinessModule {}
