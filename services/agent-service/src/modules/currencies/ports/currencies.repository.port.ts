import type { Currency, QueryParams } from '@exprealty/shared-domain'
import type { PageResult } from '../../../common/ports/pagination.types.js'

/**
 * Port (interface) for Currencies repository operations.
 * Defines the contract that any currencies data source must implement.
 *
 * This is a read-only repository since currencies are reference data
 * seeded via migrations.
 */
export interface ICurrenciesRepository {
	/**
	 * Find a currency by its numeric ID.
	 *
	 * @param id - The currency ID
	 * @returns The currency if found, null otherwise
	 */
	findById(id: number): Promise<Currency | null>

	/**
	 * Find a currency by its ISO 4217 alpha-3 code (e.g., "USD", "EUR").
	 *
	 * @param code - The ISO 4217 alpha-3 currency code
	 * @returns The currency if found, null otherwise
	 */
	findByCode(code: string): Promise<Currency | null>

	/**
	 * Retrieve a paginated list of currencies with optional filtering, sorting, and search.
	 *
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Paginated list of currencies with total count
	 */
	findPage(query: Partial<QueryParams>): Promise<PageResult<Currency>>
}
