import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { ContactMethod, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { IContactMethodRepository } from './ports/contact-method.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';
import type { IAgentRepository } from '../ports/agent.repository.port.js';
import type { CreateContactMethodDto, UpdateContactMethodDto } from './dto/index.js';

/**
 * Service layer for contact method business logic.
 * @public
 */
@Injectable()
export class ContactMethodService {
	constructor(
		@Inject('IContactMethodRepository')
		private readonly contactMethodRepo: IContactMethodRepository,
		@Inject('IAgentRepository')
		private readonly agentRepo: IAgentRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('ContactMethodService');
	}

	/**
	 * Validates that the agent exists.
	 */
	private async ensureAgentExists(agentId: string): Promise<void> {
		const agent = await this.agentRepo.findById(agentId);
		if (!agent) {
			throw new NotFoundException({
				message: `Agent with id '${agentId}' not found`,
				i18nType: 'agent.not_found',
			});
		}
	}

	/**
	 * Creates a new contact method for an agent.
	 */
	async create(agentId: string, data: CreateContactMethodDto): Promise<ContactMethod> {
		await this.ensureAgentExists(agentId);

		// Check for unique name conflict
		const existing = await this.contactMethodRepo.findByName(data.name);
		if (existing) {
			throw new ConflictException({
				message: `Contact method with name '${data.name}' already exists`,
				i18nType: 'contactmethod.name_conflict',
			});
		}

		this.logger.info(`Creating contact method for agent ${agentId}`);

		return this.contactMethodRepo.create({
			...data,
			agentId,
		});
	}

	/**
	 * Finds a contact method by ID for a specific agent.
	 */
	async findById(agentId: string, contactMethodId: string): Promise<ContactMethod> {
		await this.ensureAgentExists(agentId);

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
		await this.ensureAgentExists(agentId);

		this.logger.debug(`Fetching contact methods for agent ${agentId}`);

		return this.contactMethodRepo.findByAgentId(agentId, query, selection);
	}

	/**
	 * Updates a contact method for an agent.
	 */
	async update(
		agentId: string,
		contactMethodId: string,
		data: UpdateContactMethodDto,
	): Promise<ContactMethod> {
		// Verify agent and contact method exist
		await this.findById(agentId, contactMethodId);

		// If name is being changed, check for conflicts
		if (data.name) {
			const existing = await this.contactMethodRepo.findByName(data.name);
			if (existing && existing.id !== contactMethodId) {
				throw new ConflictException({
					message: `Contact method with name '${data.name}' already exists`,
					i18nType: 'contactmethod.name_conflict',
				});
			}
		}

		this.logger.info(`Updating contact method ${contactMethodId} for agent ${agentId}`);

		return this.contactMethodRepo.update(contactMethodId, data);
	}
}
