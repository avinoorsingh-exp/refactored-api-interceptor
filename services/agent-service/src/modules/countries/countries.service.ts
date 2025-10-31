import { Injectable, ConflictException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { CountryEntity } from '@exprealty/database'
import type { CreateCountryInput, Country } from '@exprealty/shared-domain'
import { CountryResponseDto } from './dto/country-response.dto.js'

/**
 * Service for managing Country entities.
 * Handles business logic for country operations.
 */
@Injectable()
export class CountriesService {
	private readonly logger = new Logger(CountriesService.name)

	constructor(
		@InjectRepository(CountryEntity)
		private readonly countryRepository: Repository<CountryEntity>,
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
			// Create entity instance
			const country = this.countryRepository.create({
				name: createCountryDto.name.trim(),
				alpha2: createCountryDto.alpha2.trim(),
				alpha3: createCountryDto.alpha3.trim(),
				number: createCountryDto.number,
				dialingCode: createCountryDto.dialingCode,
			})

			// Persist to database
			const savedCountry = await this.countryRepository.save(country)

			const duration = Date.now() - startTime
			this.logger.log(
				`Country created successfully: ${savedCountry.alpha2} (${savedCountry.countryId}) in ${duration}ms`,
			)

			// Map to response DTO
			return this.mapToResponse(savedCountry)
		} catch (error) {
			const duration = Date.now() - startTime

			// Handle unique constraint violation
			if (error instanceof QueryFailedError) {
				const pgError = error as QueryFailedError & { code?: string; constraint?: string }

				// PostgreSQL unique violation error code
				if (pgError.code === '23505') {
					this.logger.warn(
						`Duplicate country code attempted: ${createCountryDto.alpha2} (${duration}ms)`,
					)
					throw new ConflictException({
						type: 'duplicate_country_code',
						title: 'Country Already Exists',
						detail: `A country with alpha-2 code '${createCountryDto.alpha2}' already exists`,
						conflictingCode: createCountryDto.alpha2,
					})
				}
			}

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
	 * Maps a CountryEntity to a Country domain type.
	 * 
	 * @param entity - The country entity from the database
	 * @returns The country domain object
	 */
	private mapToResponse(entity: CountryEntity): Country {
		return {
			countryId: entity.countryId,
			name: entity.name,
			alpha2: entity.alpha2,
			alpha3: entity.alpha3,
			number: entity.number,
			dialingCode: entity.dialingCode,
		}
	}
}