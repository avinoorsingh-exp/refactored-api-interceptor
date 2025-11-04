import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CompanyEntity } from '@exprealty/database'
import { CompaniesController } from './companies.controller.js'
import { CompaniesService } from './companies.service.js'

/**
 * Module for Company entity operations.
 */
@Module({
	imports: [TypeOrmModule.forFeature([CompanyEntity])],
	controllers: [CompaniesController],
	providers: [CompaniesService],
	exports: [CompaniesService],
})
export class CompaniesModule {}
