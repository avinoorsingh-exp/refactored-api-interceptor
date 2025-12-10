import { Injectable, ConflictException, Logger, NotFoundException, Inject } from '@nestjs/common';
import type { IOfficesRepository } from './ports/offices.repository.port.js';
import type { CreateOfficeInput, UpdateOfficeInput, Office, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Application service for managing Office aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IOfficesRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class OfficesService {

	constructor(
		@Inject('IOfficesRepository')
		private readonly repository: IOfficesRepository,
        private readonly logger: LoggerService
	) {
        this.logger.setContext(OfficesService.name);
    }

	/**
	 * Creates a new office record.
	 *
	 * @param dto - Office data to create (validated by Zod)
	 * @returns The created office entity
	 * @throws ConflictException if an office with the same name already exists
	 */
	async create(dto: CreateOfficeInput): Promise<Office> {
		const startTime = Date.now();

		try {
			// Check for existing office with same name
			const existing = await this.repository.findByName(dto.name);

			if (existing) {
				throw new ConflictException({
					message: `An office with name '${dto.name}' already exists`,
					i18nType: 'agent.office.duplicate_name',
				});
			}

			// Create office via repository
			const savedOffice = await this.repository.create(dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Office created successfully: ${savedOffice.id} (${savedOffice.name}) in ${duration}ms`,
			);

			return savedOffice;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create office ${dto.name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves an office by its ID (bigint as string).
	 *
	 * @param id - Office ID
	 * @returns The office entity
	 * @throws NotFoundException if office with the given id does not exist
	 */
	async findById(id: string): Promise<Office> {
		const startTime = Date.now();

		try {
			const office = await this.repository.findById(id);

			if (!office) {
				throw new NotFoundException({
					message: `Office with id '${id}' not found`,
					i18nType: 'agent.office.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Office retrieved: ${office.id} (${office.name}) in ${duration}ms`,
			);

			return office;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve office ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves an office by its name.
	 *
	 * @param name - Office name
	 * @returns The office entity
	 * @throws NotFoundException if office with the given name does not exist
	 */
	async findByName(name: string): Promise<Office> {
		const startTime = Date.now();

		try {
			const office = await this.repository.findByName(name);

			if (!office) {
				throw new NotFoundException({
					message: `Office with name '${name}' not found`,
					i18nType: 'agent.office.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Office retrieved: ${office.id} (${office.name}) in ${duration}ms`,
			);

			return office;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve office ${name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves offices by company ID.
	 *
	 * @param companyId - Company ID (bigint as string)
	 * @returns Array of offices belonging to the company
	 */
	async findByCompanyId(companyId: string): Promise<Office[]> {
		const startTime = Date.now();

		try {
			const offices = await this.repository.findByCompanyId(companyId);

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Retrieved ${offices.length} offices for company ${companyId} in ${duration}ms`,
			);

			return offices;
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(
				`Failed to retrieve offices for company ${companyId}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of offices.
	 *
	 * @param queryParams - Query parameters for pagination, filtering, sorting, and search
	 * @param fields - Field selection for response projection
	 * @returns Paginated list of offices
	 */
	async findAll(queryParams: QueryParams, fields?: FieldSelection) {
		const startTime = Date.now();

		try {
			const result = await this.repository.findPage(queryParams, fields);

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Retrieved ${result.items.length} of ${result.total} offices in ${duration}ms`,
			);

			return { data: result.items, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(
				`Failed to retrieve offices: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Updates an existing office.
	 *
	 * @param id - Office ID
	 * @param dto - Office data to update
	 * @returns The updated office entity
	 * @throws NotFoundException if office with the given id does not exist
	 * @throws ConflictException if updating name to an existing name
	 */
	async update(id: string, dto: UpdateOfficeInput): Promise<Office> {
		const startTime = Date.now();

		try {
			// Verify office exists
			const existing = await this.repository.findById(id);
			if (!existing) {
				throw new NotFoundException({
					message: `Office with id '${id}' not found`,
					i18nType: 'agent.office.not_found',
				});
			}

			// Check for name conflict if updating name
			if (dto.name && dto.name !== existing.name) {
				const nameExists = await this.repository.findByName(dto.name);
				if (nameExists) {
					throw new ConflictException({
						message: `An office with name '${dto.name}' already exists`,
						i18nType: 'agent.office.duplicate_name',
					});
				}
			}

			// Update office via repository
			const updatedOffice = await this.repository.update(id, dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Office updated successfully: ${updatedOffice.id} (${updatedOffice.name}) in ${duration}ms`,
			);

			return updatedOffice;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException || error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to update office ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}
}
