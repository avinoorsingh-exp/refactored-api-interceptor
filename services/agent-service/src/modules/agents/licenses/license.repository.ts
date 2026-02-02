import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseEntity, CountryEntity, StateEntity, LineOfBusinessEntity } from '@exprealty/database';
import type { License, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { ILicenseRepository, CountryLookup, StateLookup, LineOfBusinessLookup } from './ports/license.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';


/**
 * TypeORM adapter implementing ILicenseRepository port.
 * @public
 */
@Injectable()
export class LicenseTypeOrmRepository implements ILicenseRepository {
	constructor(
		@InjectRepository(LicenseEntity)
		private readonly repo: Repository<LicenseEntity>,
		@InjectRepository(CountryEntity)
		private readonly countryRepo: Repository<CountryEntity>,
		@InjectRepository(StateEntity)
		private readonly stateRepo: Repository<StateEntity>,
		@InjectRepository(LineOfBusinessEntity)
		private readonly lineOfBusinessRepo: Repository<LineOfBusinessEntity>,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('LicenseRepository');
	}

	/**
	 * Maps a TypeORM LicenseEntity to a domain License type.
	 */
	private mapToDomain(entity: LicenseEntity): License {
		return {
			id: entity.id,
			agentId: entity.agentId,
			number: entity.number,
			type: entity.type,
			isPrimary: entity.isPrimary,
			firstName: entity.firstName,
			middleName: entity.middleName,
			lastName: entity.lastName,
			suffix: entity.suffix,
			expirationDate: entity.expirationDate ? entity.expirationDate.toISOString().split('T')[0] : undefined,
			lineOfBusinessId: entity.lineOfBusinessId,
			countryId: entity.countryId,
			stateCode: entity.stateCode,
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
		} as unknown as License;
	}

	/**
	 * Maps domain License data to entity data for persistence.
	 */
	private mapToEntity(data: Partial<License>): Partial<LicenseEntity> {
		const entityData: Record<string, unknown> = {};

		if (data.agentId !== undefined) entityData.agentId = data.agentId;
		if (data.number !== undefined) entityData.number = data.number;
		if (data.type !== undefined) entityData.type = data.type;
		if (data.isPrimary !== undefined) entityData.isPrimary = data.isPrimary;
		if (data.firstName !== undefined) entityData.firstName = data.firstName;
		if (data.middleName !== undefined) entityData.middleName = data.middleName;
		if (data.lastName !== undefined) entityData.lastName = data.lastName;
		if (data.suffix !== undefined) entityData.suffix = data.suffix;
		if (data.lineOfBusinessId !== undefined) entityData.lineOfBusinessId = data.lineOfBusinessId;
		if (data.countryId !== undefined) entityData.countryId = data.countryId;
		if (data.stateCode !== undefined) entityData.stateCode = data.stateCode;

		// Handle expirationDate - convert string to Date if needed
		if (data.expirationDate !== undefined) {
			entityData.expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;
		}

		return entityData as Partial<LicenseEntity>;
	}

	async create(data: Partial<License>): Promise<License> {
		const entityData = this.mapToEntity(data);
		const entity = this.repo.create(entityData);
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}

	async findById(id: string): Promise<License | null> {
		const entity = await this.repo.findOne({ where: { id } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByAgentAndNumber(agentId: string, number: string): Promise<License | null> {
		const entity = await this.repo.findOne({ where: { agentId, number } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		_selection?: FieldSelection,
	): Promise<PageResult<License>> {
		const offset = query?.offset ?? 0;
		const limit = Math.min(query?.limit ?? 25, 50);

		const [entities, total] = await this.repo.findAndCount({
			where: { agentId },
			skip: offset,
			take: limit,
			order: { number: 'ASC' },
		});

		return {
			items: entities.map((e) => this.mapToDomain(e)),
			total,
		};
	}

	async update(id: string, data: Partial<License>): Promise<License> {
		const entityData = this.mapToEntity(data);
		await this.repo.update(id, entityData);
		const updated = await this.repo.findOneOrFail({ where: { id } });
		return this.mapToDomain(updated);
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id);
	}

	async findPrimaryByAgentId(agentId: string): Promise<License | null> {
		const entity = await this.repo.findOne({
			where: { agentId, isPrimary: true },
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	// ==========================================
	// REFERENCE LOOKUPS
	// ==========================================

	async findCountryById(countryId: number): Promise<CountryLookup | null> {
		const entity = await this.countryRepo.findOne({
			where: { id: countryId },
			select: ['id', 'alpha2', 'name'],
		});
		if (!entity) return null;
		return {
			id: entity.id,
			alpha2: entity.alpha2,
			name: entity.name,
		};
	}

	async findStateByCodeAndCountry(stateCode: string, countryId: number): Promise<StateLookup | null> {
		const entity = await this.stateRepo.findOne({
			where: { code: stateCode, countryId },
			select: ['code', 'countryId', 'name'],
		});
		if (!entity) return null;
		return {
			code: entity.code,
			countryId: entity.countryId,
			name: entity.name,
		};
	}

	async findLineOfBusinessById(lineOfBusinessId: string): Promise<LineOfBusinessLookup | null> {
		const entity = await this.lineOfBusinessRepo.findOne({
			where: { id: lineOfBusinessId },
			select: ['id', 'name'],
		});
		if (!entity) return null;
		return {
			id: entity.id,
			name: entity.name,
		};
	}
}
