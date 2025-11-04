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
				name: createCountryDto.name,
				alpha2: createCountryDto.alpha2,
				alpha3: createCountryDto.alpha3,
				number: createCountryDto.number,
				dialingCode: createCountryDto.dialingCode,
			})

			// Persist to database
			const savedCountry = await this.countryRepository.save(country)

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.log(
				`Country created successfully: ${savedCountry.alpha2} (${savedCountry.countryId}) in ${duration}ms`,
			)

			// Map to response DTO
			return this.mapToResponse(savedCountry)
		} catch (error) {
			const duration = Date.now() - startTime

			// Handle unique constraint violation
			if (error instanceof QueryFailedError) {
				const pgError = error as QueryFailedError & { 
					code?: string
					constraint?: string
					detail?: string
					table?: string
				}

				// TODO: REVIEW - PostgreSQL unique violation error code
				if (pgError.code === '23505') {
					// Determine which field caused the conflict by checking error detail
					// PostgreSQL error detail format: "Key (column_name)=(value) already exists."
					let conflictField = 'code'
					let conflictValue = ''

					const errorDetail = pgError.detail || ''
					
					if (errorDetail.includes('(alpha_2)') || errorDetail.includes('alpha_2')) {
						conflictField = 'alpha-2'
						conflictValue = createCountryDto.alpha2
					} else if (errorDetail.includes('(alpha_3)') || errorDetail.includes('alpha_3')) {
						conflictField = 'alpha-3'
						conflictValue = createCountryDto.alpha3
					} else if (errorDetail.includes('(number)') || errorDetail.includes('number')) {
						conflictField = 'number'
						conflictValue = createCountryDto.number.toString()
					}

					// TODO: Remove debug logging before PR
					this.logger.warn(
						`Duplicate country ${conflictField} attempted: ${conflictValue} (${duration}ms)`,
					)
					throw new ConflictException({
						message: `A country with ${conflictField} code '${conflictValue}' already exists`,
						i18nType: 'agent.country.duplicate_code',
					})
				}
			}

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
			// Check if country already exists
			const existingCountry = await this.countryRepository.findOne({
				where: { alpha2: dto.alpha2 },
			})

			// TODO: Remove debug logging before PR
			this.logger.debug(
				`Upsert ${dto.alpha2}: existing=${existingCountry ? 'YES (id=' + existingCountry.countryId + ')' : 'NO'}`,
			)

			const wasCreated = !existingCountry

			// Perform upsert operation
			// TypeORM's upsert will INSERT or UPDATE based on conflict with alpha_2
			await this.countryRepository.upsert(dto, {
				conflictPaths: ['alpha2'],
				skipUpdateIfNoValuesChanged: true,
			})

			// Fetch the final country state
			const country = await this.countryRepository.findOne({
				where: { alpha2: dto.alpha2 },
			})

			if (!country) {
				throw new Error(
					`Country not found after upsert: ${dto.alpha2}`,
				)
			}

			const duration = Date.now() - startTime
			const operation = wasCreated ? 'created' : 'updated'
			// TODO: Remove debug logging before PR
			this.logger.log(
				`Country ${operation}: ${country.alpha2} (${country.countryId}) in ${duration}ms`,
			)

			return {
				country: this.mapToResponse(country),
				created: wasCreated,
			}
		} catch (error) {
			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
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
			const country = await this.countryRepository.findOne({
				where: { alpha2: code },
			})

			const duration = Date.now() - startTime
			
			// TODO: Remove debug logging before PR
			if (country) {
				this.logger.log(
					`Country found: ${country.alpha2} (${country.countryId}) in ${duration}ms`,
				)
				return this.mapToResponse(country)
			}

			// TODO: Remove debug logging before PR
			this.logger.log(
				`Country not found: ${code} in ${duration}ms`,
			)
			return null
		} catch (error) {
			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.error(
				`Failed to find country ${code}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)
			throw error
		}
	}
}