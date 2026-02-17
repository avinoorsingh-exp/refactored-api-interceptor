import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type { IAgentTaxRepository } from './ports/agent-tax.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentTaxEntity, TaxEntity } from '@exprealty/database';
import type { AgentTax, Tax, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';

/**
 * Query configuration for AgentTax entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const AGENT_TAX_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'agentId', 'taxId', 'isPrimary'],
	allowedSortFields: ['id', 'agentId', 'taxId', 'isPrimary'],
	allowedSearchFields: ['agentId', 'taxId'],
	defaultSort: { field: 'id', direction: 'ASC' },
	useStrategySearch: true,
};

/**
 * TypeORM adapter implementing IAgentTaxRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class AgentTaxTypeOrmRepository
	extends BaseTypeOrmRepository<AgentTaxEntity, AgentTax>
	implements IAgentTaxRepository
{
	constructor(
		@InjectRepository(AgentTaxEntity)
		repo: Repository<AgentTaxEntity>,
		@InjectRepository(TaxEntity)
		private readonly taxRepo: Repository<TaxEntity>,
		private readonly dataSource: DataSource,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('AgentTaxRepository');
	}

	protected getEntityClass(): new () => AgentTaxEntity {
		return AgentTaxEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return AGENT_TAX_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'agent_tax';
	}

	/**
	 * Maps a TypeORM AgentTaxEntity to a domain type.
	 */
	protected mapToDomain(entity: AgentTaxEntity): AgentTax {
		return {
			id: entity.id,
			agentId: entity.agentId,
			taxId: entity.taxId,
			isPrimary: entity.isPrimary,
			tax: entity.tax ? this.mapTaxToDomain(entity.tax) : undefined,
		};
	}

	/**
	 * Maps a TaxEntity to a domain Tax type.
	 */
	private mapTaxToDomain(entity: TaxEntity): Tax {
		return {
			id: entity.id,
			taxIdType: entity.taxIdType,
			value: entity.typeLast4 ? '*****' + entity.typeLast4 : '',
			valueToken: entity.typeHashed,
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
			mxid: entity.mxid,
		};
	}

	/**
	 * Maps domain data to entity data for persistence.
	 */
	protected mapToEntity(data: Partial<AgentTax>): Partial<AgentTaxEntity> {
		const entityData: Partial<AgentTaxEntity> = {};

		if (data.agentId !== undefined) entityData.agentId = data.agentId;
		if (data.taxId !== undefined) entityData.taxId = data.taxId;
		if (data.isPrimary !== undefined) entityData.isPrimary = data.isPrimary;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IAgentTaxRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<AgentTax>> {
		return this.findWithQuery(query, selection);
	}

	async findByAgentId(agentId: string, query?: Partial<QueryParams>): Promise<PageResult<AgentTax>> {
		const offset = query?.offset ?? 0;
		const limit = Math.min(query?.limit ?? 25, 50);

		const [entities, total] = await this.repo.findAndCount({
			where: { agentId },
			relations: ['tax'],
			skip: offset,
			take: limit,
			order: { id: 'ASC' },
		});

		return {
			items: entities.map((entity) => this.mapToDomain(entity)),
			total,
		};
	}

	async findByAgentAndTax(agentId: string, taxId: string): Promise<AgentTax | null> {
		const entity = await this.repo.findOne({
			where: { agentId, taxId },
			relations: ['tax'],
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	async findPrimaryByAgentId(agentId: string): Promise<AgentTax | null> {
		const entity = await this.repo.findOne({
			where: { agentId, isPrimary: true },
			relations: ['tax'],
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	/**
	 * Creates a Tax record and AgentTax association in a single transaction.
	 */
	async createWithTax(
		agentId: string,
		taxData: { taxIdType: string; valueLast4: string; valueToken: string },
		isPrimary: boolean,
	): Promise<AgentTax> {
		return this.dataSource.transaction(async (manager) => {
			// Create Tax entity
			const taxEntity = manager.create(TaxEntity, {
				taxIdType: taxData.taxIdType as any,
				typeLast4: taxData.valueLast4,
				typeHashed: taxData.valueToken,
			});
			const savedTax = await manager.save(TaxEntity, taxEntity);

			// Create AgentTax association
			// The partial unique index idx_agent_tax_agent_primary enforces
			// at most one primary per agent at the DB level.
			const agentTaxEntity = manager.create(AgentTaxEntity, {
				agentId,
				taxId: savedTax.id,
				isPrimary,
			});
			const savedAgentTax = await manager.save(AgentTaxEntity, agentTaxEntity);

			// Build domain object directly — no need to re-fetch (no transformers)
			return {
				id: savedAgentTax.id,
				agentId: savedAgentTax.agentId,
				taxId: savedAgentTax.taxId,
				isPrimary: savedAgentTax.isPrimary,
				tax: this.mapTaxToDomain(savedTax),
			};
		});
	}

	/**
	 * Updates a Tax record with pre-computed last4 and token values.
	 */
	async updateTaxValue(taxId: string, valueLast4: string, valueToken: string): Promise<Tax> {
		await this.taxRepo.update(taxId, {
			typeLast4: valueLast4,
			typeHashed: valueToken,
		});

		const updated = await this.taxRepo.findOne({ where: { id: taxId } });
		if (!updated) {
			throw new Error(`Tax with id ${taxId} not found after update`);
		}

		return this.mapTaxToDomain(updated);
	}

	/**
	 * Override findById to include tax relation.
	 */
	async findById(id: string): Promise<AgentTax | null> {
		const entity = await this.repo.findOne({
			where: { id } as any,
			relations: ['tax'],
		});
		return entity ? this.mapToDomain(entity) : null;
	}
}
