import { Module } from '@nestjs/common';
import { LookupCountriesController } from './lookup-countries.controller.js';
import { CountriesModule } from '../countries/countries.module.js';

/**
 * Standalone lookup module for GET /v1/lookup/countries.
 * Uses CountriesService from CountriesModule; no global validation.
 */
@Module({
	imports: [CountriesModule],
	controllers: [LookupCountriesController],
})
export class LookupModule {}
