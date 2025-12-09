import {
	Injectable,
	NotFoundException,
	ConflictException,
	Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CompanyEntity } from '@exprealty/database'
import type { CreateCompanyInput, UpdateCompanyInput, Company, Name, NormalizedPagination, QueryParams } from '@exprealty/shared-domain'
import { QueryService } from '../../common/query/query.service.js'

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
		private readonly queryService: QueryService,
	) {}

	/**
	 * Creates a new company record.
	 *
	 * @param dto - Company data to create (validated by Zod)
	 * @returns The created company entity
	 * @throws ConflictException if a company with the same normalized name already exists
	 */
	async create(dto: CreateCompanyInput): Promise<Company> {
		const startTime = Date.now()

		try {
			// Normalize name for duplicate check (lowercase, trim)
			const normalizedName = dto.name.toLowerCase().trim()

			// Check for existing company with same normalized name
			const existing = await this.companyRepository.findOne({
				where: { name: normalizedName as Name },
			})

			if (existing) {
				throw new ConflictException({
					message: `A company with name '${dto.name}' already exists`,
					i18nType: 'agent.company.duplicate_name',
				})
			}

			// Create entity instance with normalized name
			const company = this.companyRepository.create({
				name: normalizedName as any,
				email: dto.email as any,
			})

			// Persist to database
			const savedCompany = await this.companyRepository.save(company)

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.log(
				`Company created successfully: ${savedCompany.id} (${savedCompany.name}) in ${duration}ms`,
			)

			return this.mapToResponse(savedCompany)
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof ConflictException) {
				throw error
			}

			// TODO: Remove debug logging before PR
			// Log unexpected errors
			this.logger.error(
				`Failed to create company ${dto.name}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

	/**
	 * Retrieves a paginated list of companies with optional filtering, sorting, and search.
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Object containing array of companies and total count
	 */
	async findPage(query: Partial<QueryParams>): Promise<{ companies: Company[]; total: number }> {
		const startTime = Date.now()

		// Validate and normalize query params using entity decorators
		const normalized = this.queryService.normalizeWithValidation(query, CompanyEntity)

		// Build query with TypeORM query builder
		const qb = this.companyRepository.createQueryBuilder('company')

		// Apply filters, search, and sorting with strategy-based search for numeric fields
		this.queryService.applyAllWithStrategies(qb, normalized, CompanyEntity, 'company')

		// Default sort by name ASC if no sort specified (AC-2)
		if (!normalized.sort || normalized.sort.conditions.length === 0) {
			qb.orderBy('company.name', 'ASC')
		}

		// Apply pagination
		qb.skip(normalized.offset).take(normalized.limit)

		// Execute query
		const [companies, total] = await qb.getManyAndCount()

		const duration = Date.now() - startTime
		this.logger.log(
			`Retrieved ${companies.length} companies (offset: ${normalized.offset}, limit: ${normalized.limit}, total: ${total}, ` +
			`filter: ${normalized.filter ? 'yes' : 'no'}, sort: ${normalized.sort ? 'yes' : 'no'}, search: ${normalized.search ? 'yes' : 'no'}) in ${duration}ms`,
		)

		return {
			companies: companies.map((c) => this.mapToResponse(c)),
			total,
		}
	}

	/**
	 * Retrieves a company by its UUID.
	 *
	 * @param id - Company UUID
	 * @returns The company entity
	 * @throws NotFoundException if company with the given id does not exist
	 */
	async findById(id: string): Promise<Company> {
		const startTime = Date.now()

		try {
			const company = await this.companyRepository.findOne({
				where: { id },
			})

			if (!company) {
				throw new NotFoundException({
					message: `Company with id '${id}' not found`,
					i18nType: 'agent.company.not_found',
				})
			}

			const duration = Date.now() - startTime
			// TODO: Remove debug logging before PR
			this.logger.debug(
				`Company retrieved: ${company.id} (${company.name}) in ${duration}ms`,
			)

			return this.mapToResponse(company)
		} catch (error) {
			const duration = Date.now() - startTime

			// Re-throw known exceptions
			if (error instanceof NotFoundException) {
				throw error
			}

			// TODO: Remove debug logging before PR
			// Log unexpected errors
			this.logger.error(
				`Failed to retrieve company ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				error instanceof Error ? error.stack : undefined,
			)

			// Re-throw for controller to handle
			throw error
		}
	}

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
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
		}
	}
}
