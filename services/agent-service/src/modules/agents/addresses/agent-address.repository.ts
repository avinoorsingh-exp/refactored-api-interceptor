import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AgentAddressEntity, AddressEntity } from '@exprealty/database';
import type { QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type {
	IAgentAddressRepository,
	AgentAddressWithAddress,
	CreateAgentAddressData,
	UpdateAgentAddressData,
} from './ports/agent-address.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * TypeORM adapter implementing IAgentAddressRepository port.
 * Manages both AgentAddress junction records and Address entities.
 * @public
 */
@Injectable()
export class AgentAddressTypeOrmRepository implements IAgentAddressRepository {
	constructor(
		@InjectRepository(AgentAddressEntity)
		private readonly agentAddressRepo: Repository<AgentAddressEntity>,
		@InjectRepository(AddressEntity)
		private readonly addressRepo: Repository<AddressEntity>,
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('AgentAddressRepository');
	}

	/**
	 * Maps TypeORM entities to domain response with nested address.
	 * Uses type casting to handle branded types.
	 */
	private mapToDomain(entity: AgentAddressEntity): AgentAddressWithAddress {
		const result = {
			agentId: entity.agentId,
			addressId: entity.addressId,
			isPrimary: entity.isPrimary,
		} as unknown as AgentAddressWithAddress;

		if (entity.address) {
			result.address = {
				id: entity.address.id,
				type: entity.address.type,
				role: entity.address.role,
				line1: entity.address.line1,
				line2: entity.address.line2,
				city: entity.address.city,
				unit: entity.address.unit,
				postalCode: entity.address.postalCode,
				county: entity.address.county,
				label: entity.address.label,
				stateId: entity.address.stateId,
				created: entity.address.created,
				lastModified: entity.address.lastModified,
				modifiedBy: entity.address.modifiedBy,
			};
		}

		return result;
	}

	/**
	 * Creates a new agent address with inline address creation.
	 * Uses a transaction to ensure both records are created atomically.
	 */
	async create(data: CreateAgentAddressData): Promise<AgentAddressWithAddress> {
		return this.dataSource.transaction(async (manager) => {
			// Create the address first
			const addressEntity = manager.create(AddressEntity, {
				type: data.type,
				role: data.role,
				line1: data.line1,
				line2: data.line2,
				city: data.city,
				unit: data.unit,
				postalCode: data.postalCode,
				county: data.county,
				label: data.label,
				stateId: data.stateId,
			});
			const savedAddress = await manager.save(AddressEntity, addressEntity);

			// Create the junction record (composite PK: agentId + addressId)
			const agentAddressEntity = manager.create(AgentAddressEntity, {
				agentId: data.agentId,
				addressId: savedAddress.id,
				isPrimary: data.isPrimary,
			});
			const savedAgentAddress = await manager.save(AgentAddressEntity, agentAddressEntity);

			// Attach address for response
			savedAgentAddress.address = savedAddress;

			return this.mapToDomain(savedAgentAddress);
		});
	}

	async findByCompositeKey(agentId: string, addressId: string): Promise<AgentAddressWithAddress | null> {
		const entity = await this.agentAddressRepo.findOne({
			where: { agentId, addressId },
			relations: ['address'],
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	async findPrimaryByAgentId(agentId: string): Promise<AgentAddressWithAddress | null> {
		const entity = await this.agentAddressRepo.findOne({
			where: { agentId, isPrimary: true },
			relations: ['address'],
		});
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		_selection?: FieldSelection,
	): Promise<PageResult<AgentAddressWithAddress>> {
		const offset = query?.offset ?? 0;
		const limit = Math.min(query?.limit ?? 25, 50);

		const [entities, total] = await this.agentAddressRepo.findAndCount({
			where: { agentId },
			relations: ['address'],
			skip: offset,
			take: limit,
			order: { isPrimary: 'DESC' }, // Primary first
		});

		return {
			items: entities.map((e) => this.mapToDomain(e)),
			total,
		};
	}

	/**
	 * Updates an agent address and its nested address.
	 * Uses a transaction for atomic updates.
	 * @param agentId - The agent ID (part of composite key)
	 * @param addressId - The address ID (part of composite key)
	 * @param data - Fields to update
	 */
	async update(agentId: string, addressId: string, data: UpdateAgentAddressData): Promise<AgentAddressWithAddress> {
		return this.dataSource.transaction(async (manager) => {
			// Get existing record with address using composite key
			const existing = await manager.findOne(AgentAddressEntity, {
				where: { agentId, addressId },
				relations: ['address'],
			});

			if (!existing) {
				throw new Error(`AgentAddress with agentId '${agentId}' and addressId '${addressId}' not found`);
			}

			// Update junction metadata (only isPrimary in simplified schema)
			if (data.isPrimary !== undefined) existing.isPrimary = data.isPrimary;

			await manager.save(AgentAddressEntity, existing);

			// Update address if any address fields provided
			const addressUpdates: Partial<AddressEntity> = {};
			if (data.type !== undefined) addressUpdates.type = data.type ?? undefined;
			if (data.role !== undefined) addressUpdates.role = data.role ?? undefined;
			if (data.line1 !== undefined) addressUpdates.line1 = data.line1;
			if (data.line2 !== undefined) addressUpdates.line2 = data.line2 ?? undefined;
			if (data.city !== undefined) addressUpdates.city = data.city;
			if (data.unit !== undefined) addressUpdates.unit = data.unit ?? undefined;
			if (data.postalCode !== undefined) addressUpdates.postalCode = data.postalCode;
			if (data.county !== undefined) addressUpdates.county = data.county ?? undefined;
			if (data.label !== undefined) addressUpdates.label = data.label ?? undefined;
			if (data.stateId !== undefined) addressUpdates.stateId = data.stateId ?? undefined;

			if (Object.keys(addressUpdates).length > 0 && existing.address) {
				await manager.update(AddressEntity, existing.addressId, addressUpdates);
			}

			// Fetch updated record
			const updated = await manager.findOne(AgentAddressEntity, {
				where: { agentId, addressId },
				relations: ['address'],
			});

			return this.mapToDomain(updated!);
		});
	}

	/**
	 * Deletes an agent address junction record using composite key.
	 * Note: Does NOT delete the underlying Address entity (may be shared or needed for history).
	 * @param agentId - The agent ID (part of composite key)
	 * @param addressId - The address ID (part of composite key)
	 */
	async delete(agentId: string, addressId: string): Promise<void> {
		await this.agentAddressRepo.delete({ agentId, addressId });
	}
}
