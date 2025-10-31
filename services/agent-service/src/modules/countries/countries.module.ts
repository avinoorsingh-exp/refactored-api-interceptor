import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryEntity } from '@exprealty/database';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';

/**
 * Countries Module
 * 
 * Manages country reference data (ISO 3166-1).
 */
@Module({
imports: [TypeOrmModule.forFeature([CountryEntity])],
controllers: [CountriesController],
providers: [CountriesService],
exports: [CountriesService],
})
export class CountriesModule {}
