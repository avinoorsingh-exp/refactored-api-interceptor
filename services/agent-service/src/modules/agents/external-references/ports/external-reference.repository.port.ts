import type { ExternalReferenceBase, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../../common/ports/pagination.types.js';

/**
 * Port interface for ExternalReference repository (scoped to agent).
 * @public
 */
export interface IExternalReferenceRepository {
	/**
	 * Creates an external reference and links it to an agent via the junction table.
	 */
	create(agentId: string, data: {
		systemCode: string;
		refKey: string;
		refValue: string;
		createdBy?: string;
	}): Promise<ExternalReferenceBase>;

	/**
	 * Updates an external reference that belongs to the specified agent.
	 */
	update(agentId: string, refId: string, data: {
		systemCode?: string;
		refKey?: string;
		refValue?: string;
		modifiedBy?: string;
	}): Promise<ExternalReferenceBase | null>;

	/**
	 * Finds an external reference by ID that belongs to the specified agent.
	 */
	findByIdForAgent(agentId: string, refId: string): Promise<ExternalReferenceBase | null>;

	/**
	 * Finds all external references for a specific agent with pagination.
	 */
	findByAgentId(agentId: string, query?: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<ExternalReferenceBase>>;
}
