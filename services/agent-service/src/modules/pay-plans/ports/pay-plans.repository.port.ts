import type { IRepository } from '../../../common/ports/repository.base.js';
import type { PayPlan } from '@exprealty/shared-domain';

/**
 * Repository port for PayPlan aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IPayPlansRepository extends IRepository<string, PayPlan> {
	/**
	 * Finds a pay plan by name.
	 * Used for duplicate checking and lookup operations.
	 * 
	 * @param name - Pay plan name
	 * @returns The pay plan if found, null otherwise
	 */
	findByName(name: string): Promise<PayPlan | null>;
}
