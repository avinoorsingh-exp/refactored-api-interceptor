import type { IRepository } from '../../../common/ports/repository.base.js';
import type { Office } from '@exprealty/shared-domain';

/**
 * Repository port for Office aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IOfficesRepository extends IRepository<string, Office> {
	/**
	 * Finds an office by name.
	 * Used for duplicate checking and lookup operations.
	 * 
	 * @param name - Office name
	 * @returns The office if found, null otherwise
	 */
	findByName(name: string): Promise<Office | null>;

	/**
	 * Finds offices by company ID.
	 * 
	 * @param companyId - Company ID (bigint as string)
	 * @returns Array of offices belonging to the company
	 */
	findByCompanyId(companyId: string): Promise<Office[]>;
}
