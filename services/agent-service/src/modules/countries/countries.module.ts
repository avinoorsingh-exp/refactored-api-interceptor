import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryEntity } from '@exprealty/database';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';
import { CountriesRepository } from './countries.repository.js';

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
],
controllers: [CountriesController],
providers: [
	CountriesService,
	// Provide the repository adapter under the port token
	{
		provide: 'ICountriesRepository',
		useClass: CountriesRepository,
	},
],
exports: [
	CountriesService,
	// Export repository token for use in other modules
	{
		provide: 'ICountriesRepository',
		useClass: CountriesRepository,
	},
],
})
export class CountriesModule {}
