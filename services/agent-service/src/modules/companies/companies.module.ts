import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CompanyEntity, CompanyExternalReferenceEntity, ExternalReferenceEntity } from '@exprealty/database'
import { CompaniesController } from './companies.controller.js'
import { CompaniesService } from './companies.service.js'
import { PaginationModule } from '../../common/pagination/pagination.module.js'

/**
 * Module for Company entity operations.
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 */
@Module({
	imports: [TypeOrmModule.forFeature([CompanyEntity, CompanyExternalReferenceEntity, ExternalReferenceEntity]), PaginationModule],
	controllers: [CompaniesController],
	providers: [CompaniesService],
	exports: [CompaniesService],
})
export class CompaniesModule {}
