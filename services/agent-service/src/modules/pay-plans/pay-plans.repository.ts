import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IPayPlansRepository } from './ports/pay-plans.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { PayPlanEntity } from '@exprealty/database';
import type { PayPlan, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { PAY_PLANS_PROJECTION_CONFIG } from './config/pay-plans-projection.config.js';

/**
 * Query configuration for PayPlans entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const PAY_PLANS_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'name', 'active', 'agentPercentage', 'cap'],
	allowedSortFields: ['name', 'active', 'agentPercentage', 'cap', 'created', 'lastModified'],
	allowedSearchFields: ['name', 'active', 'agentPercentage', 'cap'],
	defaultSort: { field: 'name', direction: 'ASC' },
	projectionConfig: PAY_PLANS_PROJECTION_CONFIG,
	useStrategySearch: true, // Enable type-aware search for numeric/boolean fields
};

/**
 * TypeORM adapter implementing IPayPlansRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class PayPlansTypeOrmRepository
	extends BaseTypeOrmRepository<PayPlanEntity, PayPlan, string>
	implements IPayPlansRepository
{
	constructor(
		@InjectRepository(PayPlanEntity)
		repo: Repository<PayPlanEntity>,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('PayPlansRepository');
	}

	protected getEntityClass(): new () => PayPlanEntity {
		return PayPlanEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return PAY_PLANS_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'pay_plan';
	}

	/**
	 * Maps a TypeORM PayPlanEntity to a domain PayPlan type.
	 */
	protected mapToDomain(entity: PayPlanEntity): PayPlan {
		return {
			id: entity.id,
			name: entity.name,
			active: entity.active,
			agentPercentage: Number(entity.agentPercentage),
			cap: Number(entity.cap),
			created: entity.created as PayPlan['created'],
			lastModified: entity.lastModified as PayPlan['lastModified'],
			modifiedBy: entity.modifiedBy,
			payPlanVariants: entity.payPlanVariants,
			paymentSettings: entity.paymentSettings,
		};
	}

	/**
	 * Maps domain PayPlan data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<PayPlan>): Partial<PayPlanEntity> {
		const entityData: Partial<PayPlanEntity> = {};

		if (data.name !== undefined) entityData.name = data.name;
		if (data.active !== undefined) entityData.active = data.active;
		if (data.agentPercentage !== undefined) entityData.agentPercentage = data.agentPercentage;
		if (data.cap !== undefined) entityData.cap = data.cap;
		if (data.modifiedBy !== undefined) entityData.modifiedBy = data.modifiedBy;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IPayPlansRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findByName(name: string): Promise<PayPlan | null> {
		const entity = await this.repo.findOne({ where: { name } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<PayPlan>> {
		return this.findWithQuery(query, selection);
	}

	// Override create to handle decimal conversion
	async create(data: Omit<PayPlan, 'id' | 'created' | 'lastModified' | 'modifiedBy'>): Promise<PayPlan> {
		const entity = this.repo.create({
			...this.mapToEntity(data as Partial<PayPlan>),
		});
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}
}
