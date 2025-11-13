import { Injectable, ConflictException, Logger, Inject } from '@nestjs/common'
import type { CreateCountryInput, Country } from '@exprealty/shared-domain'
import type { ICountriesRepository } from './ports/countries.repository.port.js'
import type { NormalizedPagination } from '../../common/ports/pagination.types.js'
import { CountryResponseDto } from './dto/country-response.dto.js'

/**
 * Service for managing Country entities.
 * Handles business logic for country operations.
 * 
 * This service depends on ICountriesRepository (a port/interface) rather than
 * a concrete TypeORM repository, following the Dependency Inversion Principle.
 * 
 * Benefits:
 * - Easy to unit test with mock repositories
 * - Can swap data source without changing this code
 * - Business logic is decoupled from infrastructure
 */
@Injectable()
export class CountriesService {
	private readonly logger = new Logger(CountriesService.name)

	constructor(
		@Inject('ICountriesRepository')
		private readonly countriesRepository: ICountriesRepository,
	) {}

	/**
	 * Creates a new country record.
	 * 
	 * @param createCountryDto - Country data to create (validated by Zod)
	 * @returns The created country entity
	 * @throws ConflictException if a country with the same alpha2 code already exists
	 */
	async create(createCountryDto: CreateCountryInput): Promise<Country> {
		const startTime = Date.now()

		try {
			// Use repository to create country
			const country = await this.countriesRepository.create(createCountryDto)

			const duration = Date.now() - startTime
			this.logger.log(
				`Country created successfully: ${country.alpha2} (${country.countryId}) in ${duration}ms`,
			)

			return country
		} catch (error) {
			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			// Log unexpected errors
			this.logger.error(
				`Failed to create country ${createCountryDto.alpha2}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

	/**
	 * Upserts a country record by alpha-2 code.
	 * If a country with the given alpha-2 code exists, it will be updated.
	 * Otherwise, a new country will be created.
	 * 
	 * @param dto - Country data to upsert (validated by Zod)
	 * @returns Object containing the country and a flag indicating if it was created
	 */
	async upsert(
		dto: CreateCountryInput,
	): Promise<{ country: Country; created: boolean }> {
		const startTime = Date.now()

		try {
			const result = await this.countriesRepository.upsert(dto)

			const duration = Date.now() - startTime
			const operation = result.created ? 'created' : 'updated'
			this.logger.log(
				`Country ${operation}: ${result.country.alpha2} (${result.country.countryId}) in ${duration}ms`,
			)

			return result
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to upsert country ${dto.alpha2}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)
			throw error
		}
	}

	/**
	 * Retrieves a country by its alpha-2 code.
	 * 
	 * @param code - The alpha-2 country code (e.g., "US")
	 * @returns The country entity if found, null otherwise
	 */
	async findByCode(code: string): Promise<Country | null> {
		const startTime = Date.now()

		try {
			const country = await this.countriesRepository.findByCode(code)

			const duration = Date.now() - startTime
			
			if (country) {
				this.logger.log(
					`Country found: ${country.alpha2} (${country.countryId}) in ${duration}ms`,
				)
				return country
			}

			this.logger.log(
				`Country not found: ${code} in ${duration}ms`,
			)
			return null
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to find country ${code}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)
			throw error
		}
	}

	/**
	 * Retrieves a paginated list of countries sorted by alpha-2 code ascending.
	 * 
	 * @param pagination - Normalized pagination parameters (offset, limit)
	 * @returns Object containing array of countries and total count
	 */
	async findPage(pagination: NormalizedPagination): Promise<{ countries: Country[]; total: number }> {
		const startTime = Date.now()

		try {
			const { offset, limit } = pagination

			const result = await this.countriesRepository.findPage(pagination)

			const duration = Date.now() - startTime
			this.logger.log(
				`Countries page retrieved: ${result.items.length} items (offset=${offset}, limit=${limit}, total=${result.total}) in ${duration}ms`,
			)

			return { countries: result.items, total: result.total }
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to retrieve countries page: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)
			throw error
		}
	}
}