import type { IRepository } from '../../../common/ports/repository.base.js';
import type { AgentCompanyAssociation } from '@exprealty/shared-domain';

/**
 * Repository port for AgentCompanyAssociation aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IAgentCompanyAssociationRepository extends IRepository<string, AgentCompanyAssociation> {
	/**
	 * Finds associations by agent ID.
	 * Used to list all companies an agent is associated with.
	 * 
	 * @param agentId - Agent UUID
	 * @returns All associations for the agent
	 */
	findByAgentId(agentId: string): Promise<AgentCompanyAssociation[]>;

	/**
	 * Finds association by agent ID and agent company ID.
	 * Used for duplicate checking.
	 * 
	 * @param agentId - Agent UUID
	 * @param agentCompanyId - AgentCompany UUID
	 * @returns The association if found, null otherwise
	 */
	findByAgentAndCompany(agentId: string, agentCompanyId: string): Promise<AgentCompanyAssociation | null>;

	/**
	 * Finds the primary company association for an agent.
	 * Used for business rule validation (only one primary per agent).
	 * 
	 * @param agentId - Agent UUID
	 * @returns The primary association if found, null otherwise
	 */
	findPrimaryByAgentId(agentId: string): Promise<AgentCompanyAssociation | null>;

	/**
	 * Clears the primary flag for all associations of an agent.
	 * Used when setting a new primary company.
	 * 
	 * @param agentId - Agent UUID
	 */
	clearPrimaryForAgent(agentId: string): Promise<void>;
}
