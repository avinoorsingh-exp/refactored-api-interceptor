import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common'
import type { System, CreateSystemInput, UpdateSystemInput, QueryParams, Currency } from '@exprealty/shared-domain'
import type { ISystemsRepository } from './ports/systems.repository.port.js'
import type { ICurrenciesRepository } from '../../currencies/ports/currencies.repository.port.js'
import { LoggerService } from '../../../core/logger.service.js'

/**
 * Service for managing System entities.
 * Handles business logic for system operations.
 */
@Injectable()
export class SystemsService {
	constructor(
		@Inject('ISystemsRepository')
		private readonly systemsRepository: ISystemsRepository,
		@Inject('ICurrenciesRepository')
		private readonly currenciesRepository: ICurrenciesRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(SystemsService.name)
	}

	/**
	 * Creates a new system for a country.
	 * Validates that the currency exists.
	 *
	 * @param countryId - The country ID
	 * @param createSystemDto - System data to create
	 * @returns The created system entity
	 * @throws BadRequestException if the currency doesn't exist
	 */
	async create(countryId: number, createSystemDto: CreateSystemInput): Promise<System> {
		const startTime = Date.now()

		try {
			// Validate currency exists
			const currency = await this.currenciesRepository.findById(createSystemDto.currencyId)
			if (!currency) {
				throw new BadRequestException({
					message: `Currency with ID '${createSystemDto.currencyId}' not found`,
					i18nType: 'system.currency_not_found',
				})
			}

			// Create system
			const system = await this.systemsRepository.create(countryId, createSystemDto)

			const duration = Date.now() - startTime
			this.logger.info(
				`System created successfully: ${system.id} for country ${countryId} in ${duration}ms`,
			)

			return system
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to create system for country ${countryId}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}

	/**
	 * Updates an existing system.
	 * Validates that the currency exists if provided.
	 *
	 * @param countryId - The country ID
	 * @param systemId - The system ID
	 * @param updateSystemDto - System data to update
	 * @returns The updated system entity
	 * @throws NotFoundException if the system doesn't exist or doesn't belong to the country
	 * @throws BadRequestException if the currency doesn't exist
	 */
	async update(
		countryId: number,
		systemId: string,
		updateSystemDto: UpdateSystemInput,
	): Promise<System> {
		const startTime = Date.now()

		try {
			// Verify system exists and belongs to country
			const existing = await this.systemsRepository.findByIdInCountry(countryId, systemId)
			if (!existing) {
				throw new NotFoundException({
					message: `System with ID '${systemId}' not found in country ${countryId}`,
					i18nType: 'system.not_found',
				})
			}

			// Validate currency exists if provided
			if (updateSystemDto.currencyId !== undefined) {
				const currency = await this.currenciesRepository.findById(updateSystemDto.currencyId)
				if (!currency) {
					throw new BadRequestException({
						message: `Currency with ID '${updateSystemDto.currencyId}' not found`,
						i18nType: 'system.currency_not_found',
					})
				}
			}

			// Update system
			const system = await this.systemsRepository.update(systemId, updateSystemDto)

			const duration = Date.now() - startTime
			this.logger.info(`System updated successfully: ${system.id} in ${duration}ms`)

			return system
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to update system ${systemId}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}

	/**
	 * Retrieves a system by ID within a country.
	 *
	 * @param countryId - The country ID
	 * @param systemId - The system ID
	 * @returns The system entity if found, null otherwise
	 */
	async findByIdInCountry(countryId: number, systemId: string): Promise<System | null> {
		const startTime = Date.now()

		try {
			const system = await this.systemsRepository.findByIdInCountry(countryId, systemId)

			const duration = Date.now() - startTime

			if (system) {
				this.logger.info(`System found: ${system.id} in country ${countryId} in ${duration}ms`)
				return system
			}

			this.logger.info(`System not found: ${systemId} in country ${countryId} in ${duration}ms`)
			return null
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to find system ${systemId}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}

	/**
	 * Retrieves a paginated list of systems for a country.
	 *
	 * @param countryId - The country ID
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Object containing array of systems and total count
	 */
	async findPageByCountry(
		countryId: number,
		query: Partial<QueryParams>,
	): Promise<{ systems: System[]; total: number }> {
		const startTime = Date.now()

		try {
			const result = await this.systemsRepository.findPageByCountry(countryId, query)

			const duration = Date.now() - startTime
			this.logger.info(
				`Systems page retrieved for country ${countryId}: ${result.items.length} items (offset=${query.offset ?? 0}, limit=${query.limit ?? 10}, total=${result.total}) in ${duration}ms`,
			)

			return { systems: result.items, total: result.total }
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to retrieve systems page for country ${countryId}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}

	/**
	 * Retrieves the currency for a system.
	 *
	 * @param countryId - The country ID
	 * @param systemId - The system ID
	 * @returns The currency entity
	 * @throws NotFoundException if the system doesn't exist
	 */
	async getCurrency(countryId: number, systemId: string): Promise<Currency> {
		const startTime = Date.now()

		try {
			// Verify system exists and belongs to country
			const system = await this.systemsRepository.findByIdInCountry(countryId, systemId)
			if (!system) {
				throw new NotFoundException({
					message: `System with ID '${systemId}' not found in country ${countryId}`,
					i18nType: 'system.not_found',
				})
			}

			// Get the currency
			const currency = await this.currenciesRepository.findById(system.currencyId)
			if (!currency) {
				throw new NotFoundException({
					message: `Currency with ID '${system.currencyId}' not found`,
					i18nType: 'currency.not_found',
				})
			}

			const duration = Date.now() - startTime
			this.logger.info(
				`Currency retrieved for system ${systemId}: ${currency.code} in ${duration}ms`,
			)

			return currency
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to get currency for system ${systemId}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}
}
