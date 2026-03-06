import type { License, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../../common/ports/pagination.types.js';

/**
 * Country reference lookup result.
 * @public
 */
export interface CountryLookup {
	id: number;
	alpha2: string;
	name: string;
}

/**
 * State reference lookup result.
 * @public
 */
export interface StateLookup {
	code: string;
	countryId: number;
	name: string;
}

/**
 * Line of business reference lookup result.
 * @public
 */
export interface LineOfBusinessLookup {
	id: string;
	name: string;
}

/**
 * Port interface for License repository.
 * Defines the contract that any License persistence adapter must implement.
 * @public
 */
export interface ILicenseRepository {
	/**
	 * Creates a new license.
	 */
	create(data: Partial<License>): Promise<License>;

	/**
	 * Finds a license by ID.
	 */
	findById(id: string): Promise<License | null>;

	/**
	 * Finds a license by number for a specific agent.
	 * License number uniqueness is scoped to agent, not global.
	 */
	findByAgentAndNumber(agentId: string, number: string): Promise<License | null>;

	/**
	 * Finds all licenses for a specific agent with pagination.
	 */
	findByAgentId(agentId: string, query?: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<License>>;

	/**
	 * Finds the primary license for an agent, if one exists.
	 * Used to enforce the business rule: only one primary license per agent.
	 */
	findPrimaryByAgentId(agentId: string): Promise<License | null>;

	/**
	 * Updates an existing license.
	 */
	update(id: string, data: Partial<License>): Promise<License>;

	/**
	 * Deletes a license by ID.
	 */
	delete(id: string): Promise<void>;

	// ==========================================
	// REFERENCE LOOKUPS
	// ==========================================

	/**
	 * Finds a country by ID for validation.
	 */
	findCountryById(countryId: number): Promise<CountryLookup | null>;

	/**
	 * Finds a state by code and country for validation.
	 * Ensures state exists and belongs to the specified country.
	 */
	findStateByCodeAndCountry(stateCode: string, countryId: number): Promise<StateLookup | null>;

	/**
	 * Finds a line of business by ID for validation.
	 */
	findLineOfBusinessById(lineOfBusinessId: string): Promise<LineOfBusinessLookup | null>;
}
