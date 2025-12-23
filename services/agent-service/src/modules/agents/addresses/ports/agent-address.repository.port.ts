import type { AgentAddress, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../../common/ports/pagination.types.js';

/**
 * Extended AgentAddress with nested address data for responses.
 */
export interface AgentAddressWithAddress extends AgentAddress {
	address?: {
		id: string;
		line1: string;
		line2?: string | null;
		city: string;
		unit: string;
		postalCode: string;
		country: string;
		createdAt: Date;
		updatedAt: Date;
	};
}

/**
 * Data for creating an AgentAddress with inline address creation.
 */
export interface CreateAgentAddressData {
	agentId: string;
	// Junction metadata
	role?: 'home' | 'office' | 'mailing' | 'billing' | 'other';
	isPrimary: boolean;
	validFrom?: string;
	validTo?: string;
	// Address data (inline creation)
	line1: string;
	line2?: string | null;
	city: string;
	unit: string;
	postalCode: string;
	country: string;
}

/**
 * Data for updating an AgentAddress.
 */
export interface UpdateAgentAddressData {
	// Junction metadata
	role?: 'home' | 'office' | 'mailing' | 'billing' | 'other';
	isPrimary?: boolean;
	validFrom?: string;
	validTo?: string;
	// Address data (optional updates)
	line1?: string;
	line2?: string | null;
	city?: string;
	unit?: string;
	postalCode?: string;
	country?: string;
}

/**
 * Port interface for AgentAddress repository.
 * Defines the contract that any AgentAddress persistence adapter must implement.
 * @public
 */
export interface IAgentAddressRepository {
	/**
	 * Creates a new agent address with inline address creation.
	 * Creates both Address entity and AgentAddress junction record.
	 */
	create(data: CreateAgentAddressData): Promise<AgentAddressWithAddress>;

	/**
	 * Finds an agent address by ID with nested address.
	 */
	findById(id: string): Promise<AgentAddressWithAddress | null>;

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
	 */
	update(id: string, data: UpdateAgentAddressData): Promise<AgentAddressWithAddress>;

	/**
	 * Deletes an agent address by ID.
	 * Note: This removes the junction only, not the underlying Address.
	 */
	delete(id: string): Promise<void>;
}
