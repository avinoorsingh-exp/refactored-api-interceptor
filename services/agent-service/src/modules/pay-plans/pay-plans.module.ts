import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
	PayPlanEntity, 
	PayPlanVariantEntity, 
	PaymentSettingsEntity,
	PaymentSettingsVariantEntity,
	AgentEntity,
	AgentCompanyEntity,
} from '@exprealty/database';
import { PayPlansController } from './pay-plans.controller.js';
import { PayPlansService } from './pay-plans.service.js';
import { PayPlansTypeOrmRepository } from './pay-plans.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';

/**
 * Module for PayPlan aggregate.
 * Follows Hexagonal Architecture (Ports & Adapters):
 * - PayPlansService depends on IPayPlansRepository PORT
 * - PayPlansTypeOrmRepository is the ADAPTER (infrastructure)
 * - This module wires them together via dependency injection
 * 
 * Note: QueryService is provided by QueryModule (imported globally in AppModule)
 * 
 * Entity Registration Chain (TypeORM requires all related entities):
 * PayPlanEntity → PaymentSettingsEntity → AgentEntity → AgentCompanyEntity
 *               → PayPlanVariantEntity
 *               → PaymentSettingsVariantEntity
 */
@Module({
	imports: [
		// Register PayPlanEntity and all related entities for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			PayPlanEntity,
			PayPlanVariantEntity,
			PaymentSettingsEntity,
			PaymentSettingsVariantEntity,
			AgentEntity,
			AgentCompanyEntity,
		]),
		PaginationModule,
	],
	controllers: [PayPlansController],
	providers: [
		PayPlansService,
		ProjectionService,
		// Provide the repository adapter under the port token
		{
			provide: 'IPayPlansRepository',
			useClass: PayPlansTypeOrmRepository,
		},
	],
	exports: [PayPlansService],
})
export class PayPlansModule {}
