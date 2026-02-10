import type { IRepository } from '../../../common/ports/repository.base.js';
import type { AgentCompany } from '@exprealty/shared-domain';

/**
 * Repository port for AgentCompany aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IAgentCompanyRepository extends IRepository<string, AgentCompany> {
	/**
	 * Finds an agent company by name.
	 * Used for duplicate checking.
	 * 
	 * @param name - Company name
	 * @returns The company if found, null otherwise
	 */
	findByName(name: string): Promise<AgentCompany | null>;

	/**
	 * Finds an agent company by legacy ID.
	 * Used for migration and backward compatibility.
	 * 
	 * @param legacyId - Legacy system ID
	 * @returns The company if found, null otherwise
	 */
	findByLegacyId(legacyId: string): Promise<AgentCompany | null>;
}
