import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { LoggerService } from '../../../core/logger.service.js';
import type { IAgentRepository } from '../../agents/ports/agent.repository.port.js';
import type { IStatesRepository } from '../../states/ports/states.repository.port.js';
import type { ICountriesRepository } from '../../countries/ports/countries.repository.port.js';
import { EnterpriseAgentUpsertSchema, type EnterpriseAgentUpsertInput } from '../schemas/enterprise-agent-upsert.schema.js';
import { AgentEntity, OfficeEntity, MLSEntity, AddressEntity, AgentOfficeEntity, AgentMLSEntity, ContactMethodEntity, AgentAddressEntity, CompanyEntity } from '@exprealty/database';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

/**
 * Service for upserting Enterprise_AgentUpdated_V2 translated payload.
 * Handles agent and all associations (MLS, offices, addresses, contactMethods).
 */
@Injectable()
export class EnterpriseAgentUpsertService {
	constructor(
		@Inject('IAgentRepository')
		private readonly agentRepository: IAgentRepository,
		@Inject('IStatesRepository')
		private readonly statesRepository: IStatesRepository,
		@Inject('ICountriesRepository')
		private readonly countriesRepository: ICountriesRepository,
		@InjectRepository(OfficeEntity)
		private readonly officeRepository: Repository<OfficeEntity>,
		@InjectRepository(MLSEntity)
		private readonly mlsRepository: Repository<MLSEntity>,
		@InjectRepository(AddressEntity)
		private readonly addressRepository: Repository<AddressEntity>,
		@InjectRepository(AgentAddressEntity)
		private readonly agentAddressRepositoryEntity: Repository<AgentAddressEntity>,
		@InjectRepository(CompanyEntity)
		private readonly companyRepository: Repository<CompanyEntity>,
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('EnterpriseAgentUpsertService');
	}

	/**
	 * Upserts agent and all associations from Enterprise_AgentUpdated_V2 translated payload.
	 * Validates payload with Zod before processing.
	 */
	async upsertAgentWithAssociations(payload: unknown): Promise<void> {
		const startTime = Date.now();

		try {
			// Normalize legacy payloads before validation
			// This handles:
			// 1. agentCompanyId (removed field) - remove if present
			// 2. Invalid suffix values (empty string, invalid enum values) - remove if invalid
			const normalized = this.normalizeLegacyPayload(payload);
			
			// Validate payload with Zod
			const validated = EnterpriseAgentUpsertSchema.parse(normalized);

			// Use transaction to ensure atomicity
			// If ANY operation fails, the entire transaction will roll back and throw an error
			// TypeORM transactions automatically roll back on any unhandled error
			await this.dataSource.transaction(async (manager) => {
				// 1. Upsert agent
				const agent = await this.upsertAgent(validated.agent, manager);
				this.logger.debug('Agent upserted successfully', { 
					agentId: agent.id, 
					agentIdValue: agent.agentId,
					payloadAgentId: validated.agent.agentId,
				});

				// 2. Upsert contact methods
				await this.upsertContactMethods(agent.id, validated.contactMethods, manager);
				this.logger.debug('Contact methods upserted successfully', { count: validated.contactMethods.length });

				// 3. Upsert addresses
				await this.upsertAddresses(agent.id, validated.addresses, manager);
				this.logger.debug('Addresses upserted successfully', { count: validated.addresses.length });

				// 4. Upsert offices
				// This may throw a foreign key constraint error if companyId is invalid
				// The transaction will automatically roll back if this throws
				await this.upsertOffices(agent.id, validated.offices, manager);
				this.logger.debug('Offices upserted successfully', { count: validated.offices.length });

				// 5. Upsert MLS
				await this.upsertMLS(agent.id, validated.mls, manager);
				this.logger.debug('MLS upserted successfully', { count: validated.mls.length });
			});

			const duration = Date.now() - startTime;
			this.logger.info(`Successfully upserted agent with all associations in ${duration}ms`, {
				agentId: validated.agent.id || validated.agent.agentId,
			});
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof z.ZodError) {
				this.logger.error('Zod validation failed for Enterprise_AgentUpdated_V2 payload', {
					errors: error.errors,
					duration,
				});
				throw error;
			}

			// Log detailed error information for database errors
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
			
			// Check for foreign key constraint violations
			const isForeignKeyError = errorMessage.includes('foreign key') || 
			                          errorMessage.includes('FK_') ||
			                          errorMessage.includes('23503');
			
			this.logger.error('Failed to upsert agent with associations', {
				errorName,
				errorMessage,
				errorStack,
				isForeignKeyError,
				duration,
				// Include error code if it's a database error
				...(error instanceof Error && 'code' in error && { errorCode: (error as any).code }),
			});
			
			// ALWAYS re-throw the error - transaction should roll back
			throw error;
		}
	}

	/**
	 * Normalize legacy payloads to handle fields that were removed or changed.
	 * 
	 * This handles:
	 * 1. agentCompanyId - removed field, strip if present
	 * 2. Invalid suffix values - empty strings or values not in enum, remove if invalid
	 * 
	 * This is needed for retries of ERROR messages that were stored with old format.
	 * New messages are validated during translation, so they won't need normalization.
	 */
	private normalizeLegacyPayload(payload: unknown): unknown {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return payload;
		}

		const normalized = { ...payload } as Record<string, unknown>;

		// Normalize agent object if present
		if (normalized.agent && typeof normalized.agent === 'object' && !Array.isArray(normalized.agent)) {
			const agent = { ...normalized.agent } as Record<string, unknown>;

			// Remove agentCompanyId if present (legacy field)
			if ('agentCompanyId' in agent) {
				delete agent.agentCompanyId;
			}

			// Normalize suffix: validate against enum and remove if invalid
			if ('suffix' in agent) {
				const validSuffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq'] as const;
				const rawSuffix = agent.suffix ? String(agent.suffix).trim() : null;
				
				if (rawSuffix && rawSuffix.length > 0 && validSuffixes.includes(rawSuffix as any)) {
					// Valid suffix - keep it
					agent.suffix = rawSuffix;
				} else {
					// Invalid suffix (empty, null, or not in enum) - remove it
					delete agent.suffix;
				}
			}

			normalized.agent = agent;
		}

		return normalized;
	}

	/**
	 * Upserts agent (finds by id, or creates new if id provided but not found).
	 * Requires agent.id (UUID) to be present in payload - will not create agents without an ID.
	 */
	private async upsertAgent(
		agentData: EnterpriseAgentUpsertInput['agent'],
		manager: any,
	): Promise<AgentEntity> {
		// CRITICAL: agent.id is required by schema, but double-check here for safety
		if (!agentData.id) {
			throw new Error('Agent ID (UUID) is required in payload. Cannot create agent without ID.');
		}

		// Try to find by id (required field)
		const agent = await manager.findOne(AgentEntity, { where: { id: agentData.id } });

		// Prepare agent data for save
		const agentEntityData: Partial<AgentEntity> = {
			firstName: agentData.firstName,
			lastName: agentData.lastName,
			middleName: agentData.middleName,
			suffix: agentData.suffix,
			preferredName: agentData.preferredName,
			title: agentData.title,
			birthDate: agentData.birthDate,
			lifecycleStatus: agentData.lifecycleStatus as any,
			joinDate: agentData.joinDate,
			anniversaryDate: agentData.anniversaryDate,
			terminationDate: agentData.terminationDate,
			isStaff: agentData.isStaff,
			systemId: agentData.systemId,
			modifiedBy: 'Enterprise',
		};

		// Set agentId if provided in payload (for both create and update)
		// Note: agentId is a bigint, so we need to ensure it's set as a string
		if (agentData.agentId) {
			agentEntityData.agentId = agentData.agentId;
		}

		if (agent) {
			// Update existing agent
			Object.assign(agent, agentEntityData);
			return await manager.save(AgentEntity, agent);
		} else {
			// Create new agent with the provided ID (ID is required, so it must be present)
			const newAgent = manager.create(AgentEntity, {
				...agentEntityData,
				id: agentData.id, // Use the provided UUID
			});
			return await manager.save(AgentEntity, newAgent);
		}
	}

	/**
	 * Upserts contact methods for agent.
	 * Replaces all existing contact methods with the new ones.
	 */
	private async upsertContactMethods(
		agentId: string,
		contactMethods: EnterpriseAgentUpsertInput['contactMethods'],
		manager: any,
	): Promise<void> {
		// Delete existing contact methods
		await manager.delete(ContactMethodEntity, { agentId });

		// Create new contact methods
		for (const cm of contactMethods) {
			const contactMethod = manager.create(ContactMethodEntity, {
				agentId,
				name: cm.name,
				channel: cm.channel,
				value: cm.value,
				isPrimary: cm.isPrimary,
				subType: cm.subType,
				smsOptIn: cm.smsOptIn ?? false,
				modifiedBy: 'Enterprise',
			});
			await manager.save(ContactMethodEntity, contactMethod);
		}
	}

	/**
	 * Upserts addresses for agent.
	 * Finds or creates addresses and links them via AgentAddress junction table.
	 */
	private async upsertAddresses(
		agentId: string,
		addresses: EnterpriseAgentUpsertInput['addresses'],
		manager: any,
	): Promise<void> {
		// Delete existing agent-address associations
		await manager.delete(AgentAddressEntity, { agentId });

		for (const addrData of addresses) {
			// Lookup country if countryAlpha2 provided (countryId is required)
			let countryId: number | undefined;
			if (addrData.countryAlpha2) {
				const country = await this.countriesRepository.findByCode(addrData.countryAlpha2);
				if (!country) {
					this.logger.warn('Country not found for address, skipping address', {
						agentId,
						countryAlpha2: addrData.countryAlpha2,
						line1: addrData.line1,
						city: addrData.city,
					});
					continue; // Skip this address if country not found
				}
				countryId = country.id;
			} else {
				// If no countryAlpha2 provided, try to derive from state
				if (addrData.stateCode) {
					const state = await this.statesRepository.findByCode(addrData.stateCode);
					if (state?.country?.id) {
						countryId = state.country.id;
					}
				}
				
				// If still no countryId, we can't create the address (countryId is required)
				if (!countryId) {
					this.logger.warn('Cannot determine countryId for address, skipping address', {
						agentId,
						stateCode: addrData.stateCode,
						line1: addrData.line1,
						city: addrData.city,
					});
					continue; // Skip this address if we can't determine country
				}
			}

			// Find or create address
			// AddressEntity uses stateCode (string), not stateId
			const addressQuery: any = {
				line1: addrData.line1,
				city: addrData.city,
				postalCode: addrData.postalCode,
				countryId: countryId, // Include countryId in query for uniqueness
			};
			
			// Use stateCode if provided (not stateId)
			if (addrData.stateCode) {
				addressQuery.stateCode = addrData.stateCode;
			}

			let address = await manager.findOne(AddressEntity, {
				where: addressQuery,
			});

			if (address) {
				// Update existing address with new data
				Object.assign(address, {
					line1: addrData.line1,
					line2: addrData.line2,
					city: addrData.city,
					postalCode: addrData.postalCode,
					unit: addrData.unit,
					county: addrData.county,
					label: addrData.label,
					type: addrData.type,
					role: addrData.role,
					stateCode: addrData.stateCode, // Use stateCode, not stateId
					countryId: countryId, // Ensure countryId is set
					modifiedBy: 'Enterprise',
				});
				address = await manager.save(AddressEntity, address);
			} else {
				// Create new address
				address = manager.create(AddressEntity, {
					line1: addrData.line1,
					line2: addrData.line2,
					city: addrData.city,
					postalCode: addrData.postalCode,
					unit: addrData.unit,
					county: addrData.county,
					label: addrData.label,
					type: addrData.type,
					role: addrData.role,
					stateCode: addrData.stateCode, // Use stateCode, not stateId
					countryId: countryId, // Required field
					modifiedBy: 'Enterprise',
				});
				address = await manager.save(AddressEntity, address);
			}

			// Create agent-address association (composite primary key)
			const agentAddress = manager.create(AgentAddressEntity, {
				agentId,
				addressId: address.id,
				isPrimary: addrData.isPrimary,
			});
			await manager.save(AgentAddressEntity, agentAddress);
		}
	}

	/**
	 * Upserts offices for agent.
	 * Finds or creates offices and links them via AgentOffice junction table.
	 */
	private async upsertOffices(
		agentId: string,
		offices: EnterpriseAgentUpsertInput['offices'],
		manager: any,
	): Promise<void> {
		// Delete existing agent-office associations
		await manager.delete(AgentOfficeEntity, { agentId });

		for (const officeData of offices) {
			// Validate companyId is provided (required field)
			if (!officeData.companyId) {
				this.logger.warn('Skipping office - companyId is required but not provided', {
					officeName: officeData.officeName,
				});
				continue;
			}

			// Validate company exists
			// Company.id is bigint (stored as string in TypeScript)
			// Ensure companyId is treated as a string for the lookup
			const companyId = String(officeData.companyId);
			const company = await manager.findOne(CompanyEntity, {
				where: { id: companyId },
			});

			if (!company) {
				this.logger.error('Skipping office - company does not exist', {
					officeName: officeData.officeName,
					companyId: companyId,
					companyIdType: typeof companyId,
				});
				continue;
			}

			this.logger.debug('Company found for office', {
				officeName: officeData.officeName,
				companyId: companyId,
				companyName: company.name,
			});

			// Find or create office
			// Try to find by officeId first if provided, otherwise by name
			let office: OfficeEntity | null = null;
			if (officeData.officeId) {
				office = await manager.findOne(OfficeEntity, {
					where: { id: officeData.officeId },
				});
			}
			if (!office) {
				office = await manager.findOne(OfficeEntity, {
					where: { name: officeData.officeName },
				});
			}

			// Ensure required fields have defaults
			const lifecycleStatus = officeData.lifecycleStatus || 'active';
			const phone = officeData.phone || '';
			const primaryState = officeData.primaryState || '';

			if (office) {
				// Update existing office with new data
				Object.assign(office, {
					name: officeData.officeName,
					companyId: companyId, // Use validated companyId (required field)
					lifecycleStatus: lifecycleStatus, // Always set (required field)
					phone: phone, // Set default if not provided
					...(officeData.website && { website: officeData.website }),
					primaryState: primaryState, // Set default if not provided
					modifiedBy: 'Enterprise',
				});
				try {
					office = await manager.save(OfficeEntity, office);
				} catch (saveError) {
					this.logger.error('Failed to save office entity', {
						officeName: officeData.officeName,
						companyId: companyId,
						officeId: office.id,
						error: saveError instanceof Error ? saveError.message : 'Unknown error',
						stack: saveError instanceof Error ? saveError.stack : undefined,
					});
					throw saveError; // Re-throw to trigger transaction rollback
				}
			} else {
				// Create new office
				office = manager.create(OfficeEntity, {
					name: officeData.officeName,
					companyId: companyId, // Use validated companyId (required field)
					lifecycleStatus: lifecycleStatus, // Always set (required field)
					phone: phone, // Set default if not provided
					...(officeData.website && { website: officeData.website }),
					primaryState: primaryState, // Set default if not provided
					modifiedBy: 'Enterprise',
				});
				try {
					office = await manager.save(OfficeEntity, office);
				} catch (saveError) {
					this.logger.error('Failed to save new office entity', {
						officeName: officeData.officeName,
						companyId: companyId,
						error: saveError instanceof Error ? saveError.message : 'Unknown error',
						stack: saveError instanceof Error ? saveError.stack : undefined,
					});
					throw saveError; // Re-throw to trigger transaction rollback
				}
			}

			// Create agent-office association
			const agentOffice = manager.create(AgentOfficeEntity, {
				agentId,
				officeId: office.id,
				isPrimary: officeData.isPrimary,
			});
			try {
				await manager.save(AgentOfficeEntity, agentOffice);
			} catch (saveError) {
				this.logger.error('Failed to save agent-office association', {
					agentId,
					officeId: office.id,
					officeName: officeData.officeName,
					error: saveError instanceof Error ? saveError.message : 'Unknown error',
					stack: saveError instanceof Error ? saveError.stack : undefined,
				});
				throw saveError; // Re-throw to trigger transaction rollback
			}
		}
	}

	/**
	 * Upserts MLS for agent.
	 * Looks up MLS by global_id using mlsId from payload.
	 * If MLS is not found, skips insert and association.
	 */
	private async upsertMLS(
		agentId: string,
		mlsArray: EnterpriseAgentUpsertInput['mls'],
		manager: any,
	): Promise<void> {
		// Delete existing agent-MLS associations
		await manager.delete(AgentMLSEntity, { agentId });

		for (const mlsData of mlsArray) {
			// Look up MLS by global_id using mlsId from payload
			// mlsId in the payload maps to global_id in the database
			if (!mlsData.mlsId) {
				this.logger.warn('Skipping MLS - mlsId is required but not provided', {
					mlsName: mlsData.name,
				});
				continue;
			}

			// Convert mlsId to number for global_id lookup
			// global_id is an integer column in the database
			const globalId = Number(mlsData.mlsId);
			if (isNaN(globalId)) {
				this.logger.warn('Skipping MLS - mlsId is not a valid number', {
					mlsName: mlsData.name,
					mlsId: mlsData.mlsId,
				});
				continue;
			}

			// Look up MLS by global_id
			const mls = await manager.findOne(MLSEntity, {
				where: { globalId: globalId },
			});

			if (!mls) {
				this.logger.warn('Skipping MLS - not found in database by global_id', {
					mlsName: mlsData.name,
					mlsId: mlsData.mlsId,
					globalId: globalId,
				});
				continue; // Skip insert and association if MLS not found
			}

			// MLS found - just create the association
			// Don't update MLS information - that's handled by another process
			const agentMLS = manager.create(AgentMLSEntity, {
				agentId,
				mlsId: mls.id,
			});
			await manager.save(AgentMLSEntity, agentMLS);
		}
	}
}

