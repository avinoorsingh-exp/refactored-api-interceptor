import type { IRepository } from '../../../common/ports/repository.base.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import type { AgentTax, Tax, QueryParams } from '@exprealty/shared-domain';

/**
 * Repository port for AgentTax aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IAgentTaxRepository extends IRepository<string, AgentTax> {
	/**
	 * Finds tax associations for an agent with pagination.
	 * Returns AgentTax with nested Tax entity.
	 *
	 * @param agentId - Agent UUID
	 * @param query - Optional pagination/filter params
	 * @returns Paginated tax associations for the agent
	 */
	findByAgentId(agentId: string, query?: Partial<QueryParams>): Promise<PageResult<AgentTax>>;

	/**
	 * Finds association by agent ID and tax ID.
	 * Used for duplicate checking.
	 *
	 * @param agentId - Agent UUID
	 * @param taxId - Tax UUID
	 * @returns The association if found, null otherwise
	 */
	findByAgentAndTax(agentId: string, taxId: string): Promise<AgentTax | null>;

	/**
	 * Finds the primary tax association for an agent.
	 * Used for business rule validation (only one primary per agent).
	 *
	 * @param agentId - Agent UUID
	 * @returns The primary association if found, null otherwise
	 */
	findPrimaryByAgentId(agentId: string): Promise<AgentTax | null>;

	/**
	 * Creates a Tax record and AgentTax association in a single transaction.
	 *
	 * @param agentId - Agent UUID
	 * @param taxData - Pre-computed tax data (taxIdType, valueLast4, valueToken)
	 * @param isPrimary - Whether this is the primary tax for the agent
	 * @returns The created AgentTax with nested Tax
	 */
	createWithTax(
		agentId: string,
		taxData: { taxIdType: string; valueLast4: string; valueToken: string },
		isPrimary: boolean,
	): Promise<AgentTax>;

	/**
	 * Updates a Tax record with pre-computed last4 and token values.
	 *
	 * @param taxId - Tax UUID
	 * @param valueLast4 - Last 4 digits of the tax ID
	 * @param valueToken - HMAC-SHA256 token
	 * @returns The updated Tax
	 */
	updateTaxValue(taxId: string, valueLast4: string, valueToken: string): Promise<Tax>;
}
