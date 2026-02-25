import type { Note, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../../common/ports/pagination.types.js';

/**
 * Port interface for Note repository (scoped to agent).
 * @public
 */
export interface INoteRepository {
	/**
	 * Creates a new note and links it to an agent via the agent_note junction table.
	 */
	create(agentId: string, data: { body: string; createdBy?: string }): Promise<Note>;

	/**
	 * Finds a note by ID that belongs to the specified agent.
	 */
	findByIdForAgent(agentId: string, noteId: string): Promise<Note | null>;

	/**
	 * Finds all notes for a specific agent with pagination.
	 */
	findByAgentId(agentId: string, query?: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<Note>>;
}
