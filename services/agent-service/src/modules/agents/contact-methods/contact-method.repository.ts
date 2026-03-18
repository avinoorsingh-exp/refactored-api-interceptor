import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMethodEntity } from '@exprealty/database';
import type { ContactMethod, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { IContactMethodRepository } from './ports/contact-method.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Internal type for domain contact method with correct audit field names.
 * Works around compiled type mismatch between createdAt/updatedAt and created/lastModified.
 */
type ContactMethodDomain = Omit<ContactMethod, 'createdAt' | 'updatedAt'> & {
	created: Date;
	lastModified: Date;
	modifiedBy: string;
};

/**
 * TypeORM adapter implementing IContactMethodRepository port.
 * @public
 */
@Injectable()
export class ContactMethodTypeOrmRepository implements IContactMethodRepository {
	constructor(
		@InjectRepository(ContactMethodEntity)
		private readonly repo: Repository<ContactMethodEntity>,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('ContactMethodRepository');
	}

	/**
	 * Maps a TypeORM ContactMethodEntity to a domain ContactMethod type.
	 */
	private mapToDomain(entity: ContactMethodEntity): ContactMethod {
		const domain: ContactMethodDomain = {
			id: String(entity.id),
			name: entity.name,
			channel: entity.channel,
			subType: entity.subType,
			value: entity.value,
			isPrimary: entity.isPrimary,
			smsOptIn: entity.smsOptIn,
			agentId: entity.agentId,
			// Map entity audit fields to domain field names
			created: (entity as any).created ?? (entity as any).createdAt,
			lastModified: (entity as any).lastModified ?? (entity as any).updatedAt,
			modifiedBy: (entity as any).modifiedBy ?? 'system',
		};
		return domain as unknown as ContactMethod;
	}

	/**
	 * Maps domain ContactMethod data to entity data for persistence.
	 */
	private mapToEntity(data: Partial<ContactMethod>): Partial<ContactMethodEntity> {
		const entityData: Record<string, unknown> = {};

		if (data.name !== undefined) entityData.name = data.name;
		if (data.channel !== undefined) entityData.channel = data.channel;
		if (data.subType !== undefined) entityData.subType = data.subType;
		if (data.value !== undefined) entityData.value = data.value;
		if (data.isPrimary !== undefined) entityData.isPrimary = data.isPrimary;
		if (data.smsOptIn !== undefined) entityData.smsOptIn = data.smsOptIn;
		if (data.agentId !== undefined) entityData.agentId = data.agentId;

		return entityData as Partial<ContactMethodEntity>;
	}

	async create(data: Partial<ContactMethod>): Promise<ContactMethod> {
		const entityData = this.mapToEntity(data);
		const entity = this.repo.create(entityData);
		const saved = await this.repo.save(entity);
		return this.mapToDomain(saved);
	}

	async findById(id: string): Promise<ContactMethod | null> {
		const entity = await this.repo.findOne({ where: { id } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByAgentAndName(agentId: string, name: string): Promise<ContactMethod | null> {
		const entity = await this.repo.findOne({ where: { agentId, name } });
		return entity ? this.mapToDomain(entity) : null;
	}

	async findPrimaryByAgentAndChannel(agentId: string, channel: 'email' | 'phone'): Promise<ContactMethod | null> {
		const entity = await this.repo.findOne({
			where: { agentId, channel, isPrimary: true },
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		_selection?: FieldSelection,
	): Promise<PageResult<ContactMethod>> {
		const offset = query?.offset ?? 0;
		const limit = Math.min(query?.limit ?? 25, 50);

		const [entities, total] = await this.repo.findAndCount({
			where: { agentId },
			skip: offset,
			take: limit,
			order: { name: 'ASC' },
		});

		return {
			items: entities.map((e) => this.mapToDomain(e)),
			total,
		};
	}

	async update(id: string, data: Partial<ContactMethod>): Promise<ContactMethod> {
		const entityData = this.mapToEntity(data);
		await this.repo.update(id, entityData);
		const updated = await this.repo.findOneOrFail({ where: { id } });
		return this.mapToDomain(updated);
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id);
	}
}
