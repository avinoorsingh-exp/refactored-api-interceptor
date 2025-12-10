import { Injectable, ConflictException, Logger, NotFoundException, Inject } from '@nestjs/common';
import type { IPayPlansRepository } from './ports/pay-plans.repository.port.js';
import type { CreatePayPlanInput, UpdatePayPlanInput, PayPlan, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Application service for managing PayPlan aggregate.
 * Handles business logic and orchestrates domain operations.
 * 
 * Depends on IPayPlansRepository PORT (not concrete implementation).
 * This follows Dependency Inversion Principle and enables:
 * - Easy unit testing with mocked repository
 * - Swapping persistence layer without changing business logic
 * - Clean separation of concerns (Hexagonal Architecture)
 */
@Injectable()
export class PayPlansService {
	constructor(
		@Inject('IPayPlansRepository')
		private readonly repository: IPayPlansRepository,private readonly logger: LoggerService
	) {
		this.logger.setContext(PayPlansService.name);
	}

	/**
	 * Creates a new pay plan record.
	 *
	 * @param dto - Pay plan data to create (validated by Zod)
	 * @returns The created pay plan entity
	 * @throws ConflictException if a pay plan with the same name already exists
	 */
	async create(dto: CreatePayPlanInput): Promise<PayPlan> {
		const startTime = Date.now();

		try {
			// Check for existing pay plan with same name
			const existing = await this.repository.findByName(dto.name);

			if (existing) {
				throw new ConflictException({
					message: `A pay plan with name '${dto.name}' already exists`,
					i18nType: 'agent.payplan.duplicate_name',
				});
			}

			// Create pay plan via repository
			const savedPayPlan = await this.repository.create(dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Pay plan created successfully: ${savedPayPlan.id} (${savedPayPlan.name}) in ${duration}ms`,
			);

			return savedPayPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to create pay plan ${dto.name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			// Re-throw for controller to handle
			throw error;
		}
	}

	/**
	 * Retrieves a pay plan by its UUID.
	 *
	 * @param id - Pay plan UUID
	 * @returns The pay plan entity
	 * @throws NotFoundException if pay plan with the given id does not exist
	 */
	async findById(id: string): Promise<PayPlan> {
		const startTime = Date.now();

		try {
			const payPlan = await this.repository.findById(id);

			if (!payPlan) {
				throw new NotFoundException({
					message: `Pay plan with id '${id}' not found`,
					i18nType: 'agent.payplan.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Pay plan retrieved: ${payPlan.id} (${payPlan.name}) in ${duration}ms`,
			);

			return payPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve pay plan ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves a pay plan by its name.
	 *
	 * @param name - Pay plan name
	 * @returns The pay plan entity
	 * @throws NotFoundException if pay plan with the given name does not exist
	 */
	async findByName(name: string): Promise<PayPlan> {
		const startTime = Date.now();

		try {
			const payPlan = await this.repository.findByName(name);

			if (!payPlan) {
				throw new NotFoundException({
					message: `Pay plan with name '${name}' not found`,
					i18nType: 'agent.payplan.not_found',
				});
			}

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Pay plan retrieved: ${payPlan.id} (${payPlan.name}) in ${duration}ms`,
			);

			return payPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve pay plan ${name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Updates an existing pay plan.
	 *
	 * @param id - Pay plan UUID
	 * @param dto - Pay plan data to update (validated by Zod)
	 * @returns The updated pay plan entity
	 * @throws NotFoundException if pay plan with the given id does not exist
	 * @throws ConflictException if update would create duplicate name
	 */
	async update(id: string, dto: UpdatePayPlanInput): Promise<PayPlan> {
		const startTime = Date.now();

		try {
			// Verify pay plan exists
			const existingPayPlan = await this.repository.findById(id);

			if (!existingPayPlan) {
				throw new NotFoundException({
					message: `Pay plan with id '${id}' not found`,
					i18nType: 'agent.payplan.not_found',
				});
			}

			// Check for duplicate name if name is being changed
			if (dto.name && dto.name !== existingPayPlan.name) {
				const duplicatePayPlan = await this.repository.findByName(dto.name);
				if (duplicatePayPlan && duplicatePayPlan.id !== id) {
					throw new ConflictException({
						message: `A pay plan with name '${dto.name}' already exists`,
						i18nType: 'agent.payplan.duplicate_name',
					});
				}
			}

			// Update pay plan via repository
			const updatedPayPlan = await this.repository.update(id, dto as any);

			const duration = Date.now() - startTime;
			this.logger.info(
				`Pay plan updated successfully: ${updatedPayPlan.id} (${updatedPayPlan.name}) in ${duration}ms`,
			);

			return updatedPayPlan;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Re-throw known exceptions
			if (error instanceof NotFoundException || error instanceof ConflictException) {
				throw error;
			}

			// Log unexpected errors
			this.logger.error(
				`Failed to update pay plan ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}

	/**
	 * Retrieves a paginated list of pay plans with optional filtering, sorting, and search.
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @param selection - Optional field selection for projection
	 * @returns Paginated list of pay plans with total count
	 */
	async findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<{ payPlans: PayPlan[]; total: number }> {
		const startTime = Date.now();

		try {
			const result = await this.repository.findPage(query, selection);

			const duration = Date.now() - startTime;
			this.logger.debug(
				`Pay plans retrieved: ${result.items.length} of ${result.total} in ${duration}ms`,
			);

			return { payPlans: result.items, total: result.total };
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(
				`Failed to retrieve pay plans: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			);

			throw error;
		}
	}
}
