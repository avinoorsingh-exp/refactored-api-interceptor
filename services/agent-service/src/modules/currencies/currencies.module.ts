import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CurrencyEntity } from '@exprealty/database'
import { PaginationModule } from '../../common/pagination/pagination.module.js'
import { CurrenciesController } from './currencies.controller.js'
import { CurrenciesService } from './currencies.service.js'
import { CurrenciesRepository } from './currencies.repository.js'

/**
 * Module for Currency aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - CurrenciesService depends on ICurrenciesRepository PORT
 * - CurrenciesRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 *
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 */
@Module({
	imports: [TypeOrmModule.forFeature([CurrencyEntity]), PaginationModule],
	controllers: [CurrenciesController],
	providers: [
		CurrenciesService,
		// Provide the repository adapter under the port token
		{
			provide: 'ICurrenciesRepository',
			useClass: CurrenciesRepository,
		},
	],
	exports: [
		CurrenciesService,
		// Export repository token for use in other modules
		{
			provide: 'ICurrenciesRepository',
			useClass: CurrenciesRepository,
		},
	],
})
export class CurrenciesModule {}
