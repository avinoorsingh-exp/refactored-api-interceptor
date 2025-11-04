import {
	Injectable,
	NotFoundException,
	ConflictException,
	Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { CompanyEntity } from '@exprealty/database'
import type { UpdateCompanyInput, Company } from '@exprealty/shared-domain'

/**
 * Service for managing Company entities.
 * Handles business logic for company operations.
 */
@Injectable()
export class CompaniesService {
	private readonly logger = new Logger(CompaniesService.name)

	constructor(
		@InjectRepository(CompanyEntity)
		private readonly companyRepository: Repository<CompanyEntity>,
	) {}

	/**
	 * Updates an existing company record.
	 *
	 * @param id - Company UUID
	 * @param dto - Company data to update (validated by Zod)
	 * @returns The updated company entity
	 * @throws NotFoundException if company with the given id does not exist
	 * @throws ConflictException if the update would violate unique constraints
	 */
	async update(id: string, dto: UpdateCompanyInput): Promise<Company> {
		const startTime = Date.now()

		try {
			// Check if company exists
			const existingCompany = await this.companyRepository.findOne({
				where: { id },
			})

			if (!existingCompany) {
				throw new NotFoundException({
					message: `Company with id '${id}' not found`,
					i18nType: 'agent.company.not_found',
				})
			}

			// TODO: Remove debug logging before PR
			this.logger.debug(
				`Updating company: ${id} (${existingCompany.name})`,
			)

			// Update entity
			existingCompany.name = dto.name
			existingCompany.email = dto.email

			// Save changes
			const updatedCompany = await this.companyRepository.save(
				existingCompany,
			)

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.log(
				`Company updated successfully: ${updatedCompany.id} in ${duration}ms`,
			)

			return this.mapToResponse(updatedCompany)
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (
				error instanceof NotFoundException ||
				error instanceof ConflictException
			) {
				throw error
			}

			// Handle unique constraint violation
			if (error instanceof QueryFailedError) {
				const pgError = error as QueryFailedError & {
					code?: string
					constraint?: string
					detail?: string
				}

				if (pgError.code === '23505') {
					// Unique constraint violation
					let conflictField = 'field'
					let conflictValue = ''

					const errorDetail = pgError.detail || ''

					if (errorDetail.includes('(email)')) {
						conflictField = 'email'
						conflictValue = dto.email
					} else if (errorDetail.includes('(name)')) {
						conflictField = 'name'
						conflictValue = dto.name
					}

					// TODO: Remove debug logging before PR
					this.logger.warn(
						`Duplicate company ${conflictField} attempted: ${conflictValue} (${duration}ms)`,
					)
					throw new ConflictException({
						message: `A company with ${conflictField} '${conflictValue}' already exists`,
						i18nType: 'agent.company.duplicate',
					})
				}
			}

			// TODO: Remove debug logging before PR
			// Log unexpected errors
			this.logger.error(
				`Failed to update company ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

	/**
	 * Maps a CompanyEntity to a Company domain type.
	 *
	 * @param entity - The company entity from the database
	 * @returns The company domain object
	 */
	private mapToResponse(entity: CompanyEntity): Company {
		return {
			id: entity.id,
			name: entity.name as any,
			email: entity.email as any,
			createdAt: entity.createdAt as any,
			updatedAt: entity.updatedAt as any,
		}
	}
}
