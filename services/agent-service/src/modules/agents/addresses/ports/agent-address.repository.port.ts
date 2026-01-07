import type { AgentAddress, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../../common/ports/pagination.types.js';

/**
 * Extended AgentAddress with nested address data for responses.
 */
export interface AgentAddressWithAddress extends AgentAddress {
	address?: {
		id: string;
		type?: string | null;
		role?: string | null;
		line1: string;
		line2?: string | null;
		city: string;
		unit?: string | null;
		postalCode: string;
		county?: string | null;
		label?: string | null;
		stateId?: string | null;
		created: Date;
		lastModified: Date;
		modifiedBy: string;
	};
}

/**
 * Data for creating an AgentAddress with inline address creation.
 */
export interface CreateAgentAddressData {
	agentId: string;
	// Junction metadata
	isPrimary: boolean;
	// Address data (inline creation)
	type?: string;
	role?: string; // Address role (contact, bill_to, etc.)
	line1: string;
	line2?: string | null;
	city: string;
	unit?: string | null;
	postalCode: string;
	county?: string | null;
	label?: string | null;
	stateId?: string | null;
}

/**
 * Data for updating an AgentAddress.
 * Only isPrimary can be updated on the junction.
 * Address fields update the linked address.
 */
export interface UpdateAgentAddressData {
	// Junction metadata
	isPrimary?: boolean;
	// Address data (optional updates)
	type?: string | null;
	role?: string | null;
	line1?: string;
	line2?: string | null;
	city?: string;
	unit?: string | null;
	postalCode?: string;
	county?: string | null;
	label?: string | null;
	stateId?: string | null;
}

/**
 * Port interface for AgentAddress repository.
 * Defines the contract that any AgentAddress persistence adapter must implement.
 * Uses composite key (agentId, addressId) instead of single ID.
 * @public
 */
export interface IAgentAddressRepository {
	/**
	 * Creates a new agent address with inline address creation.
	 * Creates both Address entity and AgentAddress junction record.
	 */
	create(data: CreateAgentAddressData): Promise<AgentAddressWithAddress>;

	/**
	 * Finds an agent address by composite key with nested address.
	 * @param agentId - The agent ID (part of composite key)
	 * @param addressId - The address ID (part of composite key)
	 */
	findByCompositeKey(agentId: string, addressId: string): Promise<AgentAddressWithAddress | null>;

	/**
	 * Finds the primary address for an agent.
	 * Used to enforce single primary per agent.
	 */
	findPrimaryByAgentId(agentId: string): Promise<AgentAddressWithAddress | null>;

	/**
	 * Finds all addresses for a specific agent with pagination.
	 * Includes nested address data.
	 */
	findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<AgentAddressWithAddress>>;

	/**
	 * Updates an existing agent address and optionally its nested address.
	 * @param agentId - The agent ID (part of composite key)
	 * @param addressId - The address ID (part of composite key)
	 * @param data - Fields to update
	 */
	update(agentId: string, addressId: string, data: UpdateAgentAddressData): Promise<AgentAddressWithAddress>;

	/**
	 * Deletes an agent address by composite key.
	 * Note: This removes the junction only, not the underlying Address.
	 * @param agentId - The agent ID (part of composite key)
	 * @param addressId - The address ID (part of composite key)
	 */
	delete(agentId: string, addressId: string): Promise<void>;
}
