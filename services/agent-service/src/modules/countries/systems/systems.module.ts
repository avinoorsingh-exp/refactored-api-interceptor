import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SystemEntity } from '@exprealty/database'
import { PaginationModule } from '../../../common/pagination/pagination.module.js'
import { CurrenciesModule } from '../../currencies/currencies.module.js'
import { CountriesModule } from '../countries.module.js'
import { SystemsController } from './systems.controller.js'
import { SystemsService } from './systems.service.js'
import { SystemsRepository } from './systems.repository.js'

/**
 * Module for System aggregate nested under Countries.
 * Follows Hexagonal Architecture (Ports & Adapters).
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([SystemEntity]),
		PaginationModule,
		CurrenciesModule, // For currency validation
		forwardRef(() => CountriesModule), // For CountryExistsGuard
	],
	controllers: [SystemsController],
	providers: [
		SystemsService,
		{
			provide: 'ISystemsRepository',
			useClass: SystemsRepository,
		},
	],
	exports: [
		SystemsService,
		{
			provide: 'ISystemsRepository',
			useClass: SystemsRepository,
		},
	],
})
export class SystemsModule {}
