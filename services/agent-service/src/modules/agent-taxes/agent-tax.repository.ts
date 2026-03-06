import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type { FieldEncryptionService } from '@exprealty/encryption';
import type { IAgentTaxRepository } from './ports/agent-tax.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentTaxEntity, TaxEntity } from '@exprealty/database';
import type { AgentTax, Tax, TaxIdType, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { decryptMendixV0 } from '../../common/encryption/mendix-decrypt.js';

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
	private readonly hmacSecret: string;

	constructor(
		@InjectRepository(AgentTaxEntity)
		repo: Repository<AgentTaxEntity>,
		@InjectRepository(TaxEntity)
		private readonly taxRepo: Repository<TaxEntity>,
		private readonly dataSource: DataSource,
		@Inject('FIELD_ENCRYPTION')
		private readonly encryption: FieldEncryptionService,
		config: ConfigService,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('AgentTaxRepository');
		this.hmacSecret = config.get('HMAC_SECRET');
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
		// Safety cap: agents have at most 3 tax types (SSN, EIN, GSN_HST).
		// Not relied on for duplicate detection — see findByAgentIdAndType.
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

	async findByAgentIdAndType(agentId: string, taxIdType: TaxIdType): Promise<AgentTax | null> {
		const entity = await this.repo
			.createQueryBuilder('agent_tax')
			.leftJoinAndSelect('agent_tax.tax', 'tax')
			.where('agent_tax.agentId = :agentId', { agentId })
			.andWhere('tax.taxIdType = :taxIdType', { taxIdType })
			.getOne();
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
		taxData: {
			taxIdType: string;
			valueLast4: string;
			valueToken: string;
			id?: string;
			ciphertext?: Buffer;
			encryptionKeyId?: string;
			encryptionVersion?: number;
			encryptedAt?: Date;
		},
		isPrimary: boolean,
	): Promise<AgentTax> {
		return this.dataSource.transaction(async (manager) => {
			// Create Tax entity with optional pre-generated ID and encryption columns
			const taxEntity = manager.create(TaxEntity, {
				...(taxData.id ? { id: taxData.id } : {}),
				taxIdType: taxData.taxIdType as any,
				typeLast4: taxData.valueLast4,
				typeHashed: taxData.valueToken,
				...(taxData.ciphertext !== undefined ? { typeValue: taxData.ciphertext } : {}),
				...(taxData.encryptionKeyId !== undefined ? { encryptionKeyId: taxData.encryptionKeyId } : {}),
				...(taxData.encryptionVersion !== undefined ? { encryptionVersion: taxData.encryptionVersion } : {}),
				...(taxData.encryptedAt !== undefined ? { encryptedAt: taxData.encryptedAt } : {}),
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
	 * Updates a Tax record with pre-computed last4, token, and encryption values.
	 */
	async updateTaxValue(
		taxId: string,
		valueLast4: string,
		valueToken: string,
		ciphertext?: Buffer,
		encryptionKeyId?: string,
		encryptionVersion?: number,
		encryptedAt?: Date,
	): Promise<Tax> {
		await this.taxRepo.update(taxId, {
			typeLast4: valueLast4,
			typeHashed: valueToken,
			...(ciphertext !== undefined ? { typeValue: ciphertext } : {}),
			...(encryptionKeyId !== undefined ? { encryptionKeyId } : {}),
			...(encryptionVersion !== undefined ? { encryptionVersion } : {}),
			...(encryptedAt !== undefined ? { encryptedAt } : {}),
		});

		const updated = await this.taxRepo.findOne({ where: { id: taxId } });
		if (!updated) {
			throw new NotFoundException({
				message: `Tax with id '${taxId}' not found`,
				i18nType: 'agent.tax.not_found',
			});
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

	/**
	 * Decrypt the type_value for a tax record.
	 * Version-aware: handles v0 (Mendix), v1 (KMS), and null (not yet encrypted).
	 */
	async decryptTypeValue(taxId: string): Promise<string | null> {
		const entity = await this.taxRepo.findOne({ where: { id: taxId } });
		if (!entity?.typeValue) return null;

		switch (entity.encryptionVersion) {
			case null:
			case undefined:
				return null;
			case 0:
				return decryptMendixV0(entity.typeValue as Buffer, this.hmacSecret);
			case 1:
				return this.encryption.decryptField(entity.typeValue as Buffer, {
					tableName: 'tax', recordId: taxId, fieldName: 'type_value',
				});
			default:
				this.logger.warn(`Unknown encryption version ${entity.encryptionVersion} for tax ${taxId}`);
				return null;
		}
	}
}
