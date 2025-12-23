import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { IAgentAddressRepository, AgentAddressWithAddress } from './ports/agent-address.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';
import type { CreateAgentAddressDto, UpdateAgentAddressDto } from './dto/index.js';

/**
 * Service layer for agent address business logic.
 * 
 * Note: Agent existence is validated by AgentExistsGuard at the controller level.
 * This service assumes agentId is valid when methods are called.
 * 
 * Business Rules:
 * - Only one primary address per agent
 * - Address creation is inline (creates both Address and AgentAddress)
 * 
 * @public
 */
@Injectable()
export class AgentAddressService {
	constructor(
		@Inject('IAgentAddressRepository')
		private readonly agentAddressRepo: IAgentAddressRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('AgentAddressService');
	}

	/**
	 * Creates a new address for an agent.
	 * 
	 * Business rules validated:
	 * 1. Only one primary address per agent
	 */
	async create(agentId: string, data: CreateAgentAddressDto): Promise<AgentAddressWithAddress> {
		const startTime = Date.now();

		// Check primary uniqueness per agent
		if (data.isPrimary) {
			const existingPrimary = await this.agentAddressRepo.findPrimaryByAgentId(agentId);
			if (existingPrimary) {
				throw new ConflictException({
					message: 'A primary address already exists for this agent',
					i18nType: 'agentaddress.primary_exists',
				});
			}
		}

		const agentAddress = await this.agentAddressRepo.create({
			agentId,
			isPrimary: data.isPrimary,
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

		const duration = Date.now() - startTime;
		this.logger.info(`Created address ${agentAddress.addressId} for agent ${agentId} in ${duration}ms`);

		return agentAddress;
	}

	/**
	 * Finds an address by composite key for a specific agent.
	 */
	async findByCompositeKey(agentId: string, addressId: string): Promise<AgentAddressWithAddress> {
		const agentAddress = await this.agentAddressRepo.findByCompositeKey(agentId, addressId);

		if (!agentAddress) {
			throw new NotFoundException({
				message: `Address with id '${addressId}' not found for agent '${agentId}'`,
				i18nType: 'agentaddress.not_found',
			});
		}

		return agentAddress;
	}

	/**
	 * Lists all addresses for an agent with pagination.
	 */
	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<AgentAddressWithAddress>> {
		const startTime = Date.now();

		const result = await this.agentAddressRepo.findByAgentId(agentId, query, selection);

		const duration = Date.now() - startTime;
		this.logger.debug(`Fetched ${result.items.length} addresses for agent ${agentId} in ${duration}ms`);

		return result;
	}

	/**
	 * Updates an address for an agent.
	 * 
	 * Business rules validated:
	 * 1. Only one primary address per agent (if setting primary)
	 */
	async update(
		agentId: string,
		addressId: string,
		data: UpdateAgentAddressDto,
	): Promise<AgentAddressWithAddress> {
		const startTime = Date.now();

		// Verify address exists and belongs to agent
		const existing = await this.findByCompositeKey(agentId, addressId);

		// If setting as primary, check no other primary exists
		if (data.isPrimary === true && !existing.isPrimary) {
			const existingPrimary = await this.agentAddressRepo.findPrimaryByAgentId(agentId);
			if (existingPrimary && existingPrimary.addressId !== addressId) {
				throw new ConflictException({
					message: 'A primary address already exists for this agent',
					i18nType: 'agentaddress.primary_exists',
				});
			}
		}

		const updated = await this.agentAddressRepo.update(agentId, addressId, data);

		const duration = Date.now() - startTime;
		this.logger.info(`Updated address ${addressId} for agent ${agentId} in ${duration}ms`);

		return updated;
	}

	/**
	 * Deletes an address for an agent.
	 */
	async delete(agentId: string, addressId: string): Promise<void> {
		const startTime = Date.now();

		// Verify address exists and belongs to agent
		await this.findByCompositeKey(agentId, addressId);

		await this.agentAddressRepo.delete(agentId, addressId);

		const duration = Date.now() - startTime;
		this.logger.info(`Deleted address ${addressId} for agent ${agentId} in ${duration}ms`);
	}
}
