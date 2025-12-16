import type { ContactMethod, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../../common/ports/pagination.types.js';

/**
 * Port interface for ContactMethod repository.
 * Defines the contract that any ContactMethod persistence adapter must implement.
 * @public
 */
export interface IContactMethodRepository {
	/**
	 * Creates a new contact method.
	 */
	create(data: Partial<ContactMethod>): Promise<ContactMethod>;

	/**
	 * Finds a contact method by ID.
	 */
	findById(id: string): Promise<ContactMethod | null>;

	/**
	 * Finds a contact method by name.
	 */
	findByName(name: string): Promise<ContactMethod | null>;

	/**
	 * Finds all contact methods for a specific agent with pagination.
	 */
	findByAgentId(agentId: string, query?: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<ContactMethod>>;

	/**
	 * Updates an existing contact method.
	 */
	update(id: string, data: Partial<ContactMethod>): Promise<ContactMethod>;

	/**
	 * Deletes a contact method by ID.
	 */
	delete(id: string): Promise<void>;
}
