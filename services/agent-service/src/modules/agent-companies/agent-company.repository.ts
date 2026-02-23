import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FieldEncryptionService } from '@exprealty/encryption';
import type { IAgentCompanyRepository } from './ports/agent-company.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { AgentCompanyEntity } from '@exprealty/database';
import type { AgentCompany, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ConfigService } from '../../core/config.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { AGENT_COMPANY_PROJECTION_CONFIG } from './config/agent-company-projection.config.js';
import { decryptMendixV0 } from '../../common/encryption/mendix-decrypt.js';

/**
 * Query configuration for AgentCompany entity.
 * Defines which fields can be filtered, sorted, and searched.
 */
const AGENT_COMPANY_QUERY_CONFIG: BaseQueryConfig = {
	allowedFilterFields: ['id', 'legacyId', 'name', 'email', 'useSsn'],
	allowedSortFields: ['id', 'name', 'email', 'created', 'lastModified'],
	allowedSearchFields: ['name', 'email', 'legacyId'],
	defaultSort: { field: 'name', direction: 'ASC' },
	projectionConfig: AGENT_COMPANY_PROJECTION_CONFIG,
	useStrategySearch: true,
};

/**
 * TypeORM adapter implementing IAgentCompanyRepository port.
 * Extends BaseTypeOrmRepository for shared CRUD operations.
 */
@Injectable()
export class AgentCompanyTypeOrmRepository
	extends BaseTypeOrmRepository<AgentCompanyEntity, AgentCompany>
	implements IAgentCompanyRepository
{
	private readonly hmacSecret: string;

	constructor(
		@InjectRepository(AgentCompanyEntity)
		repo: Repository<AgentCompanyEntity>,
		@Inject('FIELD_ENCRYPTION')
		private readonly encryption: FieldEncryptionService,
		config: ConfigService,
		queryService: QueryService,
		logger: LoggerService,
		projectionService: ProjectionService,
	) {
		super(repo, queryService, logger, projectionService);
		this.logger.setContext('AgentCompanyRepository');
		this.hmacSecret = config.get('HMAC_SECRET');
	}

	protected getEntityClass(): new () => AgentCompanyEntity {
		return AgentCompanyEntity;
	}

	protected getQueryConfig(): BaseQueryConfig {
		return AGENT_COMPANY_QUERY_CONFIG;
	}

	protected getAlias(): string {
		return 'agent_company';
	}

	/**
	 * Maps a TypeORM AgentCompanyEntity to a domain type.
	 * Builds the masked display value from taxIdLast4.
	 * Uses type assertion for branded types since entity data is already validated.
	 */
	protected mapToDomain(entity: AgentCompanyEntity): AgentCompany {
		return {
			id: entity.id,
			legacyId: entity.legacyId,
			name: entity.name,
			email: entity.email,
			phone: entity.phone,
			taxId: entity.taxIdLast4 ? '*****' + entity.taxIdLast4 : null,
			taxIdToken: entity.taxIdHashed ?? null,
			useSsn: entity.useSsn,
			createdAt: entity.created,
			updatedAt: entity.lastModified,
		} as AgentCompany;
	}

	/**
	 * Maps domain data to entity data for persistence.
	 * Tax ID fields (taxIdLast4, taxIdToken) are pre-computed by the service layer.
	 */
	protected mapToEntity(data: Partial<AgentCompany>): Partial<AgentCompanyEntity> {
		const entityData: Partial<AgentCompanyEntity> = {};
		// The service layer strips raw taxId and substitutes pre-computed derived fields.
		const extra = data as Partial<AgentCompany> & {
			id?: string;
			taxId?: Buffer | null;
			taxIdLast4?: string | null;
			taxIdToken?: string | null;
			encryptionKeyId?: string | null;
			encryptionVersion?: number | null;
			encryptedAt?: Date | null;
		};

		if (extra.id !== undefined) entityData.id = extra.id;
		if (data.legacyId !== undefined) entityData.legacyId = data.legacyId;
		if (data.name !== undefined) entityData.name = data.name;
		if (data.email !== undefined) entityData.email = data.email;
		if (data.phone !== undefined) entityData.phone = data.phone;
		if (extra.taxId !== undefined) entityData.taxId = extra.taxId as any;
		if (extra.taxIdLast4 !== undefined) entityData.taxIdLast4 = extra.taxIdLast4;
		if (extra.taxIdToken !== undefined) entityData.taxIdHashed = extra.taxIdToken;
		if (extra.encryptionKeyId !== undefined) entityData.encryptionKeyId = extra.encryptionKeyId;
		if (extra.encryptionVersion !== undefined) entityData.encryptionVersion = extra.encryptionVersion;
		if (extra.encryptedAt !== undefined) entityData.encryptedAt = extra.encryptedAt;
		if (data.useSsn !== undefined) entityData.useSsn = data.useSsn;

		return entityData;
	}

	// -------------------------------------------------------------------------
	// IAgentCompanyRepository-specific methods (beyond base CRUD)
	// -------------------------------------------------------------------------

	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<AgentCompany>> {
		return this.findWithQuery(query, selection);
	}

	async findByName(name: string): Promise<AgentCompany | null> {
		// Case-sensitive match — company names are stored and compared as-entered.
		// "Acme Corp" and "ACME CORP" are treated as distinct names by design.
		const entity = await this.repo.findOne({ where: { name } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByLegacyId(legacyId: string): Promise<AgentCompany | null> {
		const entity = await this.repo.findOne({ where: { legacyId } });
		return entity ? this.mapToDomain(entity) : null;
	}

	/**
	 * Decrypt the taxId for a company record.
	 * Version-aware: handles v0 (Mendix), v1 (KMS), and null (not yet encrypted).
	 */
	async decryptTaxId(id: string): Promise<string | null> {
		const entity = await this.repo.findOne({ where: { id } });
		if (!entity?.taxId) return null;

		switch (entity.encryptionVersion) {
			case null:
			case undefined:
				return null;
			case 0:
				return decryptMendixV0(entity.taxId as Buffer, this.hmacSecret);
			case 1:
				return this.encryption.decryptField(entity.taxId as Buffer, {
					tableName: 'agent_company', recordId: id, fieldName: 'tax_id',
				});
			default:
				this.logger.warn(`Unknown encryption version ${entity.encryptionVersion} for company ${id}`);
				return null;
		}
	}
}
