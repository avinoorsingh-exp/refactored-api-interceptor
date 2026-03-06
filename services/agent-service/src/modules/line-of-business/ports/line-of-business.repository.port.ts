import type { IRepository } from '../../../common/ports/repository.base.js'
import type { LineOfBusiness } from '@exprealty/shared-domain'

/**
 * Repository port for LineOfBusiness aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface ILineOfBusinessRepository extends IRepository<string, LineOfBusiness> {
	/**
	 * Finds a line of business by name.
	 * Used for duplicate checking.
	 *
	 * @param name - Line of business name
	 * @returns The line of business if found, null otherwise
	 */
	findByName(name: string): Promise<LineOfBusiness | null>
}
