import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common'
import type { ILineOfBusinessRepository } from './ports/line-of-business.repository.port.js'
import type { CreateLineOfBusinessInput, LineOfBusiness } from '@exprealty/shared-domain'
import { LoggerService } from '../../core/logger.service.js'

/**
 * Application service for managing LineOfBusiness aggregate.
 * Handles business logic and orchestrates domain operations.
 *
 * Depends on ILineOfBusinessRepository PORT (not concrete implementation).
 */
@Injectable()
export class LineOfBusinessService {
	constructor(
		@Inject('ILineOfBusinessRepository')
		private readonly repository: ILineOfBusinessRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(LineOfBusinessService.name)
	}

	/**
	 * Creates a new line of business record.
	 *
	 * @param dto - Line of business data to create (validated by Zod)
	 * @returns The created line of business entity
	 * @throws ConflictException if a line of business with the same name already exists
	 */
	async create(dto: CreateLineOfBusinessInput): Promise<LineOfBusiness> {
		const startTime = Date.now()

		try {
			// Check for existing line of business with same name
			const existing = await this.repository.findByName(dto.name)

			if (existing) {
				throw new ConflictException({
					message: `A line of business with name '${dto.name}' already exists`,
					i18nType: 'lineOfBusiness.duplicate_name',
				})
			}

			// Create line of business via repository
			const saved = await this.repository.create(dto as any)

			const duration = Date.now() - startTime
			this.logger.info(
				`Line of business created successfully: ${saved.id} (${saved.name}) in ${duration}ms`,
			)

			return saved
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create line of business ${dto.name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)

			throw error
		}
	}

	/**
	 * Retrieves a line of business by its ID.
	 *
	 * @param id - Line of business ID (bigint as string)
	 * @returns The line of business entity
	 * @throws NotFoundException if not found
	 */
	async findById(id: string): Promise<LineOfBusiness> {
		const startTime = Date.now()

		try {
			const lineOfBusiness = await this.repository.findById(id)

			const duration = Date.now() - startTime

			if (!lineOfBusiness) {
				throw new NotFoundException({
					message: `Line of business with id '${id}' not found`,
					i18nType: 'lineOfBusiness.not_found',
				})
			}

			this.logger.info(
				`Line of business found: ${lineOfBusiness.id} (${lineOfBusiness.name}) in ${duration}ms`,
			)

			return lineOfBusiness
		} catch (error) {
			const duration = Date.now() - startTime

			if (error instanceof NotFoundException) {
				throw error
			}

			this.logger.error(
				`Failed to find line of business ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)

			throw error
		}
	}
}
