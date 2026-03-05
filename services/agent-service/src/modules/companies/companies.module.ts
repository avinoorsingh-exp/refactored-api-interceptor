import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CompanyEntity } from '@exprealty/database'
import { CompaniesController } from './companies.controller.js'
import { CompaniesService } from './companies.service.js'
import { PaginationModule } from '../../common/pagination/pagination.module.js'
import { QueryService } from '../../common/query/query.service.js'

/**
 * Module for Company entity operations.
 */
@Module({
	imports: [TypeOrmModule.forFeature([CompanyEntity]), PaginationModule],
	controllers: [CompaniesController],
	providers: [CompaniesService, QueryService],
	exports: [CompaniesService],
})
export class CompaniesModule {}
