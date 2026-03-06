import type { System, CreateSystemInput, UpdateSystemInput, QueryParams } from '@exprealty/shared-domain'
import type { PageResult } from '../../../../common/ports/pagination.types.js'

/**
 * Port (interface) for Systems repository operations.
 * Defines the contract that any systems data source must implement.
 */
export interface ISystemsRepository {
	/**
	 * Find a system by its ID.
	 *
	 * @param id - The system ID
	 * @returns The system if found, null otherwise
	 */
	findById(id: string): Promise<System | null>

	/**
	 * Find a system by ID within a specific country.
	 *
	 * @param countryId - The country ID
	 * @param systemId - The system ID
	 * @returns The system if found and belongs to the country, null otherwise
	 */
	findByIdInCountry(countryId: number, systemId: string): Promise<System | null>

	/**
	 * Retrieve a paginated list of systems for a country with optional filtering, sorting, and search.
	 *
	 * @param countryId - The country ID
	 * @param query - Query parameters (pagination, filter, sort, search)
	 * @returns Paginated list of systems with total count
	 */
	findPageByCountry(countryId: number, query: Partial<QueryParams>): Promise<PageResult<System>>

	/**
	 * Create a new system for a country.
	 *
	 * @param countryId - The country ID
	 * @param data - System input data
	 * @returns The created system
	 */
	create(countryId: number, data: CreateSystemInput): Promise<System>

	/**
	 * Update an existing system.
	 *
	 * @param id - The system ID
	 * @param patch - Partial system data to update
	 * @returns The updated system
	 */
	update(id: string, patch: UpdateSystemInput): Promise<System>
}
