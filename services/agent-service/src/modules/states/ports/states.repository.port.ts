import type { IRepository } from '../../../common/ports/repository.base.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import type { State, QueryParams } from '@exprealty/shared-domain';

/**
 * Repository port for State aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IStatesRepository extends IRepository<string, State> {
	/**
	 * Finds a state by code.
	 * Used for duplicate checking and lookup operations.
	 * 
	 * @param code - State code (e.g., 'TX', 'CA')
	 * @returns The state if found, null otherwise
	 */
	findByCode(code: string): Promise<State | null>;

	/**
	 * Finds states by region ID.
	 * 
	 * @param regionId - Region ID to filter by
	 * @returns Array of states in the region
	 */
	findByRegionId(regionId: string): Promise<State[]>;
}
