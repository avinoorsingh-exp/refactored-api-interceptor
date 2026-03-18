import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { LoggerService } from '../../../core/logger.service.js';
import type { IStatesRepository } from '../../states/ports/states.repository.port.js';
import type { ICountriesRepository } from '../../countries/ports/countries.repository.port.js';
import { EnterpriseAgentUpsertSchema, type EnterpriseAgentUpsertInput } from '../schemas/enterprise-agent-upsert.schema.js';
import { AgentEntity, OfficeEntity, MLSEntity, AddressEntity, AgentOfficeEntity, AgentMLSEntity, ContactMethodEntity, AgentAddressEntity, CompanyEntity } from '@exprealty/database';

/**
 * Shared executor for upserting agent and associations with a configurable modifiedBy.
 * Used by Gads, Au, and Uk agent upsert services (not by Enterprise, which has its own service).
 */
@Injectable()
export class AgentUpsertExecutorService {
	constructor(
		@Inject('IStatesRepository')
		private readonly statesRepository: IStatesRepository,
		@Inject('ICountriesRepository')
		private readonly countriesRepository: ICountriesRepository,
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('AgentUpsertExecutorService');
	}

	/**
	 * Upserts agent and all associations. Validates payload with Zod.
	 * @param payload - Translated upsert payload (agent, addresses, contactMethods; offices and mls optional, default [])
	 * @param modifiedBy - Source name for audit (e.g. 'Gads', 'Au', 'Uk')
	 */
	async upsertAgentWithAssociations(payload: unknown, modifiedBy: string): Promise<void> {
		const startTime = Date.now();

		try {
			const normalized = this.normalizeLegacyPayload(payload);
			const validated = EnterpriseAgentUpsertSchema.parse(normalized);

			await this.dataSource.transaction(async (manager) => {
				const agent = await this.upsertAgent(validated.agent, manager, modifiedBy);
				this.logger.debug('Agent upserted successfully', {
					agentId: agent.id,
					agentIdValue: agent.agentId,
					payloadAgentId: validated.agent.agentId,
				});

				await this.upsertContactMethods(agent.id, validated.contactMethods, manager, modifiedBy);
				await this.upsertAddresses(agent.id, validated.addresses, manager, modifiedBy);
				await this.upsertOffices(agent.id, validated.offices, manager, modifiedBy);
				await this.upsertMLS(agent.id, validated.mls, manager);
			});

			const duration = Date.now() - startTime;
			this.logger.info(`Successfully upserted agent with all associations in ${duration}ms`, {
				agentId: validated.agent.id || validated.agent.agentId,
				modifiedBy,
			});
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof z.ZodError) {
				this.logger.error('Zod validation failed for agent upsert payload', {
					errors: error.errors,
					duration,
					modifiedBy,
				});
				throw error;
			}

			const errorMessage = error instanceof Error ? error.message : String(error);
			const isForeignKeyError =
				errorMessage.includes('foreign key') || errorMessage.includes('FK_') || errorMessage.includes('23503');

			this.logger.error('Failed to upsert agent with associations', {
				errorMessage,
				isForeignKeyError,
				duration,
				modifiedBy,
			});
			throw error;
		}
	}

	private normalizeLegacyPayload(payload: unknown): unknown {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return payload;
		}

		const normalized = { ...payload } as Record<string, unknown>;

		if (normalized.agent && typeof normalized.agent === 'object' && !Array.isArray(normalized.agent)) {
			const agent = { ...normalized.agent } as Record<string, unknown>;

			if ('agentCompanyId' in agent) {
				delete agent.agentCompanyId;
			}

			if ('suffix' in agent) {
				const validSuffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq'] as const;
				const rawSuffix = agent.suffix ? String(agent.suffix).trim() : null;
				if (rawSuffix && rawSuffix.length > 0 && validSuffixes.includes(rawSuffix as any)) {
					agent.suffix = rawSuffix;
				} else {
					delete agent.suffix;
				}
			}

			normalized.agent = agent;
		}

		return normalized;
	}

	private async upsertAgent(
		agentData: EnterpriseAgentUpsertInput['agent'],
		manager: any,
		modifiedBy: string,
	): Promise<AgentEntity> {
		if (!agentData.id) {
			throw new Error('Agent ID (UUID) is required in payload. Cannot create agent without ID.');
		}

		const agent = await manager.findOne(AgentEntity, { where: { id: agentData.id } });

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
			modifiedBy,
		};

		if (agentData.agentId) {
			agentEntityData.agentId = agentData.agentId;
		}

		if (agent) {
			Object.assign(agent, agentEntityData);
			return await manager.save(AgentEntity, agent);
		} else {
			const newAgent = manager.create(AgentEntity, {
				...agentEntityData,
				id: agentData.id,
			});
			return await manager.save(AgentEntity, newAgent);
		}
	}

	private async upsertContactMethods(
		agentId: string,
		contactMethods: EnterpriseAgentUpsertInput['contactMethods'],
		manager: any,
		modifiedBy: string,
	): Promise<void> {
		await manager.delete(ContactMethodEntity, { agentId });

		for (const cm of contactMethods) {
			const contactMethod = manager.create(ContactMethodEntity, {
				agentId,
				name: cm.name,
				channel: cm.channel,
				value: cm.value,
				isPrimary: cm.isPrimary,
				subType: cm.subType,
				smsOptIn: cm.smsOptIn ?? false,
				modifiedBy,
			});
			await manager.save(ContactMethodEntity, contactMethod);
		}
	}

	private async upsertAddresses(
		agentId: string,
		addresses: EnterpriseAgentUpsertInput['addresses'],
		manager: any,
		modifiedBy: string,
	): Promise<void> {
		await manager.delete(AgentAddressEntity, { agentId });

		for (const addrData of addresses) {
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
					continue;
				}
				countryId = country.id;
			} else {
				if (addrData.stateCode) {
					const state = await this.statesRepository.findByCode(addrData.stateCode);
					if (state?.country?.id) {
						countryId = state.country.id;
					}
				}
				if (!countryId) {
					this.logger.warn('Cannot determine countryId for address, skipping address', {
						agentId,
						stateCode: addrData.stateCode,
						line1: addrData.line1,
						city: addrData.city,
					});
					continue;
				}
			}

			const addressQuery: any = {
				line1: addrData.line1,
				city: addrData.city,
				postalCode: addrData.postalCode,
				countryId: countryId,
			};
			if (addrData.stateCode) {
				addressQuery.stateCode = addrData.stateCode;
			}

			let address = await manager.findOne(AddressEntity, { where: addressQuery });

			if (address) {
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
					stateCode: addrData.stateCode,
					countryId: countryId,
					modifiedBy,
				});
				address = await manager.save(AddressEntity, address);
			} else {
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
					stateCode: addrData.stateCode,
					countryId: countryId,
					modifiedBy,
				});
				address = await manager.save(AddressEntity, address);
			}

			const agentAddress = manager.create(AgentAddressEntity, {
				agentId,
				addressId: address.id,
				isPrimary: addrData.isPrimary,
			});
			await manager.save(AgentAddressEntity, agentAddress);
		}
	}

	private async upsertOffices(
		agentId: string,
		offices: EnterpriseAgentUpsertInput['offices'],
		manager: any,
		modifiedBy: string,
	): Promise<void> {
		await manager.delete(AgentOfficeEntity, { agentId });

		for (const officeData of offices) {
			if (!officeData.companyId) {
				this.logger.warn('Skipping office - companyId is required but not provided', {
					officeName: officeData.officeName,
				});
				continue;
			}

			const companyId = String(officeData.companyId);
			const company = await manager.findOne(CompanyEntity, { where: { id: companyId } });

			if (!company) {
				this.logger.warn('Skipping office - company does not exist', {
					officeName: officeData.officeName,
					companyId: companyId,
				});
				continue;
			}

			let office: OfficeEntity | null = null;
			if (officeData.officeId) {
				office = await manager.findOne(OfficeEntity, { where: { id: officeData.officeId } });
			}
			if (!office) {
				office = await manager.findOne(OfficeEntity, { where: { name: officeData.officeName } });
			}

			const lifecycleStatus = officeData.lifecycleStatus || 'active';
			const phone = officeData.phone || '';
			const primaryState = officeData.primaryState || '';

			if (office) {
				Object.assign(office, {
					name: officeData.officeName,
					companyId: companyId,
					lifecycleStatus: lifecycleStatus,
					phone: phone,
					...(officeData.website && { website: officeData.website }),
					primaryState: primaryState,
					modifiedBy,
				});
				office = await manager.save(OfficeEntity, office);
			} else {
				office = manager.create(OfficeEntity, {
					name: officeData.officeName,
					companyId: companyId,
					lifecycleStatus: lifecycleStatus,
					phone: phone,
					...(officeData.website && { website: officeData.website }),
					primaryState: primaryState,
					modifiedBy,
				});
				office = await manager.save(OfficeEntity, office);
			}

			const agentOffice = manager.create(AgentOfficeEntity, {
				agentId,
				officeId: office.id,
				isPrimary: officeData.isPrimary,
			});
			await manager.save(AgentOfficeEntity, agentOffice);
		}
	}

	private async upsertMLS(
		agentId: string,
		mlsArray: EnterpriseAgentUpsertInput['mls'],
		manager: any,
	): Promise<void> {
		await manager.delete(AgentMLSEntity, { agentId });

		for (const mlsData of mlsArray) {
			if (!mlsData.mlsId) {
				this.logger.warn('Skipping MLS - mlsId is required but not provided', { mlsName: mlsData.name });
				continue;
			}

			const globalId = Number(mlsData.mlsId);
			if (isNaN(globalId)) {
				this.logger.warn('Skipping MLS - mlsId is not a valid number', {
					mlsName: mlsData.name,
					mlsId: mlsData.mlsId,
				});
				continue;
			}

			const mls = await manager.findOne(MLSEntity, { where: { globalId: globalId } });

			if (!mls) {
				this.logger.warn('Skipping MLS - not found in database by global_id', {
					mlsName: mlsData.name,
					mlsId: mlsData.mlsId,
					globalId: globalId,
				});
				continue;
			}

			const agentMLS = manager.create(AgentMLSEntity, {
				agentId,
				mlsId: mls.id,
			});
			await manager.save(AgentMLSEntity, agentMLS);
		}
	}
}
