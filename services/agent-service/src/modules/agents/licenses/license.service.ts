import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import type { License, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { ILicenseRepository } from './ports/license.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';
import type { CreateLicenseDto, UpdateLicenseDto } from './dto/index.js';

/** ISO 3166-1 alpha-2 code for United States */
const US_COUNTRY_CODE = 'US';

/**
 * Service layer for license business logic.
 *
 * Note: Agent existence is validated by AgentExistsGuard at the controller level.
 * This service assumes agentId is valid when methods are called.
 *
 * Business Rules:
 * - License number must be unique per agent (not globally)
 * - Only one primary license per agent
 * - Country must exist
 * - Line of Business must exist (if provided)
 * - Line of Business is required for US licenses
 * - State is required for US licenses
 * - State must exist and belong to the specified country
 * - Database constraints provide additional safety (unique indexes)
 *
 * @public
 */
@Injectable()
export class LicenseService {
	constructor(
		@Inject('ILicenseRepository')
		private readonly licenseRepo: ILicenseRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('LicenseService');
	}

	/**
	 * Validates that referenced entities exist and business rules are satisfied.
	 *
	 * Business Rules:
	 * - Country must exist
	 * - Line of Business must exist (if provided)
	 * - Line of Business is required for US licenses
	 * - State is required for US licenses
	 * - State must exist for the specified country
	 *
	 * @throws BadRequestException if validation fails
	 */
	private async validateReferences(
		countryId: number,
		lineOfBusinessId?: string | null,
		stateCode?: string | null,
	): Promise<void> {
		// Validate country exists
		const country = await this.licenseRepo.findCountryById(countryId);
		if (!country) {
			throw new BadRequestException({
				message: `Country with id '${countryId}' not found`,
				i18nType: 'license.country_not_found',
			});
		}

		// Validate line of business exists (if provided)
		if (lineOfBusinessId) {
			const lineOfBusiness = await this.licenseRepo.findLineOfBusinessById(lineOfBusinessId);
			if (!lineOfBusiness) {
				throw new BadRequestException({
					message: `Line of business with id '${lineOfBusinessId}' not found`,
					i18nType: 'license.line_of_business_not_found',
				});
			}
		}

		// US-specific business rules
		if (country.alpha2 === US_COUNTRY_CODE) {
			// Line of business is required for US licenses
			if (!lineOfBusinessId) {
				throw new BadRequestException({
					message: 'Line of business is required for US licenses',
					i18nType: 'license.line_of_business_required_for_us',
				});
			}

			// State is required for US licenses
			if (!stateCode) {
				throw new BadRequestException({
					message: 'State is required for US licenses',
					i18nType: 'license.state_required_for_us',
				});
			}
		}

		// Validate state exists if provided
		if (stateCode) {
			const state = await this.licenseRepo.findStateByCodeAndCountry(stateCode, countryId);
			if (!state) {
				throw new BadRequestException({
					message: `State '${stateCode}' not found for country '${country.name}'`,
					i18nType: 'license.state_not_found',
				});
			}
		}
	}

	/**
	 * Validates primary license business rule: only one primary per agent.
	 * @throws ConflictException if agent already has a primary license
	 */
	private async validatePrimaryLicense(
		agentId: string,
		isPrimary: boolean,
		excludeLicenseId?: string,
	): Promise<void> {
		if (!isPrimary) return;

		const existingPrimary = await this.licenseRepo.findPrimaryByAgentId(agentId);
		if (existingPrimary && existingPrimary.id !== excludeLicenseId) {
			throw new ConflictException({
				message: 'Agent already has a primary license',
				i18nType: 'license.primary_conflict',
			});
		}
	}

	/**
	 * Creates a new license for an agent.
	 *
	 * Business rules validated:
	 * 1. License number must be unique per agent
	 * 2. Only one primary license per agent
	 * 3. Country must exist
	 * 4. Line of Business must exist (if provided)
	 * 5. Line of Business is required for US licenses
	 * 6. State is required for US licenses
	 * 7. State must exist for specified country
	 */
	async create(agentId: string, data: CreateLicenseDto): Promise<License> {
		const startTime = Date.now();

		// Validate reference entities exist and business rules
		await this.validateReferences(data.countryId, data.lineOfBusinessId, data.stateCode);

		// Validate primary license rule
		await this.validatePrimaryLicense(agentId, data.isPrimary);

		// Check for unique license number conflict (scoped to agent)
		const existingByNumber = await this.licenseRepo.findByAgentAndNumber(agentId, data.number);
		if (existingByNumber) {
			throw new ConflictException({
				message: `License with number '${data.number}' already exists for this agent`,
				i18nType: 'license.number_conflict',
			});
		}

		const license = await this.licenseRepo.create({
			...data,
			agentId,
		} as unknown as Partial<License>);

		const duration = Date.now() - startTime;
		this.logger.info(`Created license ${license.id} for agent ${agentId} in ${duration}ms`);

		return license;
	}

	/**
	 * Finds a license by ID for a specific agent.
	 */
	async findById(agentId: string, licenseId: string): Promise<License> {
		const license = await this.licenseRepo.findById(licenseId);

		if (!license) {
			throw new NotFoundException({
				message: `License with id '${licenseId}' not found`,
				i18nType: 'license.not_found',
			});
		}

		// Ensure license belongs to the specified agent
		if (license.agentId !== agentId) {
			throw new NotFoundException({
				message: `License with id '${licenseId}' not found for agent '${agentId}'`,
				i18nType: 'license.not_found',
			});
		}

		return license;
	}

	/**
	 * Lists all licenses for an agent with pagination.
	 */
	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<License>> {
		const startTime = Date.now();

		const result = await this.licenseRepo.findByAgentId(agentId, query, selection);

		const duration = Date.now() - startTime;
		this.logger.debug(`Fetched ${result.items.length} licenses for agent ${agentId} in ${duration}ms`);

		return result;
	}

	/**
	 * Updates a license for an agent.
	 *
	 * Business rules validated:
	 * 1. License number must be unique per agent (if changed)
	 * 2. Only one primary license per agent (if isPrimary is being set to true)
	 * 3. Country must exist (if changed)
	 * 4. Line of Business must exist (if provided/changed)
	 * 5. Line of Business is required for US licenses
	 * 6. State is required for US licenses
	 * 7. State must exist for specified country (if changed)
	 */
	async update(
		agentId: string,
		licenseId: string,
		data: UpdateLicenseDto,
	): Promise<License> {
		const startTime = Date.now();

		// Verify license exists and belongs to agent
		const existing = await this.findById(agentId, licenseId);

		// Resolve values - use existing if not provided in update
		const countryId = data.countryId ?? existing.countryId;
		const lineOfBusinessId = data.lineOfBusinessId !== undefined ? data.lineOfBusinessId : existing.lineOfBusinessId;
		const stateCode = data.stateCode !== undefined ? data.stateCode : existing.stateCode;
		const isPrimary = data.isPrimary ?? existing.isPrimary;

		// Validate reference entities and business rules if any reference field changed
		const referenceChanged = 
			data.countryId !== undefined ||
			data.lineOfBusinessId !== undefined ||
			data.stateCode !== undefined;

		if (referenceChanged) {
			await this.validateReferences(countryId, lineOfBusinessId ?? undefined, stateCode);
		}

		// Validate primary license rule if isPrimary is being set to true
		if (data.isPrimary === true && !existing.isPrimary) {
			await this.validatePrimaryLicense(agentId, true, licenseId);
		}

		// If number is being changed, check for conflicts (scoped to agent)
		if (data.number && data.number !== existing.number) {
			const existingByNumber = await this.licenseRepo.findByAgentAndNumber(agentId, data.number);
			if (existingByNumber && existingByNumber.id !== licenseId) {
				throw new ConflictException({
					message: `License with number '${data.number}' already exists for this agent`,
					i18nType: 'license.number_conflict',
				});
			}
		}

		const updated = await this.licenseRepo.update(licenseId, data as unknown as Partial<License>);

		const duration = Date.now() - startTime;
		this.logger.info(`Updated license ${licenseId} for agent ${agentId} in ${duration}ms`);

		return updated;
	}
}
