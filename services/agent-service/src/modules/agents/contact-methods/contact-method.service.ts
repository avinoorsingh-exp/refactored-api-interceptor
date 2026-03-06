import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { ContactMethod, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { IContactMethodRepository } from './ports/contact-method.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';
import type { CreateContactMethodDto, UpdateContactMethodDto } from './dto/index.js';

/**
 * Service layer for contact method business logic.
 * 
 * Note: Agent existence is validated by AgentExistsGuard at the controller level.
 * This service assumes agentId is valid when methods are called.
 * 
 * Business Rules:
 * - Name must be unique per agent (not globally)
 * - Only one primary contact method per channel per agent
 * - Database constraints provide additional safety (partial unique index)
 * 
 * @public
 */
@Injectable()
export class ContactMethodService {
	constructor(
		@Inject('IContactMethodRepository')
		private readonly contactMethodRepo: IContactMethodRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('ContactMethodService');
	}

	/**
	 * Creates a new contact method for an agent.
	 * 
	 * Business rules validated:
	 * 1. Name must be unique per agent
	 * 2. Only one primary per channel per agent
	 */
	async create(agentId: string, data: CreateContactMethodDto): Promise<ContactMethod> {
		const startTime = Date.now();

		// Check for unique name conflict (scoped to agent)
		const existingByName = await this.contactMethodRepo.findByAgentAndName(agentId, data.name);
		if (existingByName) {
			throw new ConflictException({
				message: `Contact method with name '${data.name}' already exists for this agent`,
				i18nType: 'contactmethod.name_conflict',
			});
		}

		// Check primary uniqueness per channel
		if (data.isPrimary) {
			const existingPrimary = await this.contactMethodRepo.findPrimaryByAgentAndChannel(agentId, data.channel);
			if (existingPrimary) {
				throw new ConflictException({
					message: `A primary ${data.channel} contact method already exists for this agent`,
					i18nType: 'contactmethod.primary_exists',
				});
			}
		}

		const contactMethod = await this.contactMethodRepo.create({
			...data,
			agentId,
		});

		const duration = Date.now() - startTime;
		this.logger.info(`Created contact method ${contactMethod.id} for agent ${agentId} in ${duration}ms`);

		return contactMethod;
	}

	/**
	 * Finds a contact method by ID for a specific agent.
	 */
	async findById(agentId: string, contactMethodId: string): Promise<ContactMethod> {
		const contactMethod = await this.contactMethodRepo.findById(contactMethodId);

		if (!contactMethod) {
			throw new NotFoundException({
				message: `Contact method with id '${contactMethodId}' not found`,
				i18nType: 'contactmethod.not_found',
			});
		}

		// Ensure contact method belongs to the specified agent
		if (contactMethod.agentId !== agentId) {
			throw new NotFoundException({
				message: `Contact method with id '${contactMethodId}' not found for agent '${agentId}'`,
				i18nType: 'contactmethod.not_found',
			});
		}

		return contactMethod;
	}

	/**
	 * Lists all contact methods for an agent with pagination.
	 */
	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<ContactMethod>> {
		const startTime = Date.now();

		const result = await this.contactMethodRepo.findByAgentId(agentId, query, selection);

		const duration = Date.now() - startTime;
		this.logger.debug(`Fetched ${result.items.length} contact methods for agent ${agentId} in ${duration}ms`);

		return result;
	}

	/**
	 * Updates a contact method for an agent.
	 * 
	 * Business rules validated:
	 * 1. Name must be unique per agent (if changed)
	 * 2. Only one primary per channel per agent (if setting primary)
	 */
	async update(
		agentId: string,
		contactMethodId: string,
		data: UpdateContactMethodDto,
	): Promise<ContactMethod> {
		const startTime = Date.now();

		// Verify contact method exists and belongs to agent
		const existing = await this.findById(agentId, contactMethodId);

		// If name is being changed, check for conflicts (scoped to agent)
		if (data.name && data.name !== existing.name) {
			const existingByName = await this.contactMethodRepo.findByAgentAndName(agentId, data.name);
			if (existingByName && existingByName.id !== contactMethodId) {
				throw new ConflictException({
					message: `Contact method with name '${data.name}' already exists for this agent`,
					i18nType: 'contactmethod.name_conflict',
				});
			}
		}

		// If setting as primary, check no other primary exists for this channel
		if (data.isPrimary === true && !existing.isPrimary) {
			const channel = data.channel ?? existing.channel;
			const existingPrimary = await this.contactMethodRepo.findPrimaryByAgentAndChannel(agentId, channel);
			if (existingPrimary && existingPrimary.id !== contactMethodId) {
				throw new ConflictException({
					message: `A primary ${channel} contact method already exists for this agent`,
					i18nType: 'contactmethod.primary_exists',
				});
			}
		}

		const updated = await this.contactMethodRepo.update(contactMethodId, data);

		const duration = Date.now() - startTime;
		this.logger.info(`Updated contact method ${contactMethodId} for agent ${agentId} in ${duration}ms`);

		return updated;
	}
}
