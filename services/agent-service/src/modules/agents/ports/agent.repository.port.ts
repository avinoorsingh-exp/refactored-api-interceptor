import type { IRepository } from '../../../common/ports/repository.base.js';
import type { Agent } from '@exprealty/shared-domain';

/**
 * Repository port for Agent aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IAgentRepository extends IRepository<string, Agent> {
	/**
	 * Finds an agent by email.
	 * Used for duplicate checking and lookup operations.
	 * 
	 * @param email - Agent email
	 * @returns The Agent if found, null otherwise
	 */
	findByEmail(email: string): Promise<Agent | null>;

	/**
	 * Finds an agent by legacy agent ID (bigint).
	 * 
	 * @param agentId - Legacy agent ID
	 * @returns The Agent if found, null otherwise
	 */
	findByAgentId(agentId: string): Promise<Agent | null>;
}
