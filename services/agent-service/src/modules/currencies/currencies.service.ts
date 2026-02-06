import { Injectable, Inject } from '@nestjs/common'
import type { Currency, QueryParams } from '@exprealty/shared-domain'
import type { ICurrenciesRepository } from './ports/currencies.repository.port.js'
import { LoggerService } from '../../core/logger.service.js'

/**
 * Service for managing Currency entities.
 * Handles business logic for currency operations.
 *
 * This is a read-only service since currencies are reference data
 * seeded via migrations.
 */
@Injectable()
export class CurrenciesService {
	constructor(
		@Inject('ICurrenciesRepository')
		private readonly currenciesRepository: ICurrenciesRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(CurrenciesService.name)
	}

	/**
	 * Retrieves a currency by its ID.
	 *
	 * @param id - The currency ID
	 * @returns The currency entity if found, null otherwise
	 */
	async findById(id: number): Promise<Currency | null> {
		const startTime = Date.now()

		try {
			const currency = await this.currenciesRepository.findById(id)

			const duration = Date.now() - startTime

			if (currency) {
				this.logger.info(`Currency found: ${currency.code} (${currency.id}) in ${duration}ms`)
				return currency
			}

			this.logger.info(`Currency not found: ID ${id} in ${duration}ms`)
			return null
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to find currency ${id}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}

	/**
	 * Retrieves a currency by its ISO 4217 alpha-3 code.
	 *
	 * @param code - The ISO 4217 alpha-3 code (e.g., "USD")
	 * @returns The currency entity if found, null otherwise
	 */
	async findByCode(code: string): Promise<Currency | null> {
		const startTime = Date.now()

		try {
			const currency = await this.currenciesRepository.findByCode(code)

			const duration = Date.now() - startTime

			if (currency) {
				this.logger.info(`Currency found: ${currency.code} (${currency.id}) in ${duration}ms`)
				return currency
			}

			this.logger.info(`Currency not found: ${code} in ${duration}ms`)
			return null
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to find currency ${code}: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}

	/**
	 * Retrieves a paginated list of currencies with optional filtering, sorting, and search.
	 * Default sort: name ASC.
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Object containing array of currencies and total count
	 */
	async findPage(query: Partial<QueryParams>): Promise<{ currencies: Currency[]; total: number }> {
		const startTime = Date.now()

		try {
			const result = await this.currenciesRepository.findPage(query)

			const duration = Date.now() - startTime
			this.logger.info(
				`Currencies page retrieved: ${result.items.length} items (offset=${query.offset ?? 0}, limit=${query.limit ?? 10}, ` +
					`filter: ${query.filter ? 'yes' : 'no'}, sort: ${query.sort ? 'yes' : 'no'}, search: ${query.search ? 'yes' : 'no'}, total=${result.total}) in ${duration}ms`,
			)

			return { currencies: result.items, total: result.total }
		} catch (error) {
			const duration = Date.now() - startTime
			this.logger.error(
				`Failed to retrieve currencies page: ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`,
				{ stack: error instanceof Error ? error.stack : undefined },
			)
			throw error
		}
	}
}
