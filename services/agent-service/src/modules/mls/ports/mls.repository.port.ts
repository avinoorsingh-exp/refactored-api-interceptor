import type { IRepository } from '../../../common/ports/repository.base.js';
import type { MLSType } from '@exprealty/shared-domain';

/**
 * Repository port for MLS aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IMLSRepository extends IRepository<string, MLSType> {
	/**
	 * Finds an MLS by name.
	 * Used for duplicate checking and lookup operations.
	 * 
	 * @param name - MLS name
	 * @returns The MLS if found, null otherwise
	 */
	findByName(name: string): Promise<MLSType | null>;

	/**
	 * Finds an MLS by global ID.
	 * 
	 * @param globalId - Global ID
	 * @returns The MLS if found, null otherwise
	 */
	findByGlobalId(globalId: number): Promise<MLSType | null>;
}
