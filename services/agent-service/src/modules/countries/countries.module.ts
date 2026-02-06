import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryEntity } from '@exprealty/database';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';
import { CountriesRepository } from './countries.repository.js';
import { CountryExistsGuard } from '../../common/guards/country-exists.guard.js';
import { SystemsModule } from './systems/systems.module.js';

/**
 * Module for Country aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - CountriesService depends on ICountriesRepository PORT
 * - CountriesRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 *
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 */
@Module({
imports: [
	TypeOrmModule.forFeature([CountryEntity]),
	PaginationModule,
	forwardRef(() => SystemsModule),
],
controllers: [CountriesController],
providers: [
	CountriesService,
	// Provide the repository adapter under the port token
	{
		provide: 'ICountriesRepository',
		useClass: CountriesRepository,
	},
	// Provide CountriesService under the token used by CountryExistsGuard
	{
		provide: 'COUNTRIES_SERVICE',
		useExisting: CountriesService,
	},
	CountryExistsGuard,
],
exports: [
	CountriesService,
	// Export repository token for use in other modules
	{
		provide: 'ICountriesRepository',
		useClass: CountriesRepository,
	},
	// Export for use by CountryExistsGuard in other modules
	{
		provide: 'COUNTRIES_SERVICE',
		useExisting: CountriesService,
	},
	CountryExistsGuard,
],
})
export class CountriesModule {}
