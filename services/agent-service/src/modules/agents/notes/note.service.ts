import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Note, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { INoteRepository } from './ports/note.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';
import type { CreateNoteDto } from './dto/index.js';

/**
 * Service layer for note business logic.
 *
 * Agent existence is validated by AgentExistsGuard at the controller level.
 * This service assumes agentId is valid when methods are called.
 *
 * @public
 */
@Injectable()
export class NoteService {
	constructor(
		@Inject('INoteRepository')
		private readonly noteRepo: INoteRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('NoteService');
	}

	/**
	 * Creates a new note for an agent.
	 */
	async create(agentId: string, data: CreateNoteDto): Promise<Note> {
		const startTime = Date.now();

		const note = await this.noteRepo.create(agentId, {
			actor: data.actor,
			body: data.body,
		});

		const duration = Date.now() - startTime;
		this.logger.info(`Created note ${note.id} for agent ${agentId} in ${duration}ms`);

		return note;
	}

	/**
	 * Finds a note by ID for a specific agent.
	 */
	async findById(agentId: string, noteId: string): Promise<Note> {
		const note = await this.noteRepo.findByIdForAgent(agentId, noteId);

		if (!note) {
			throw new NotFoundException({
				message: `Note with id '${noteId}' not found for agent '${agentId}'`,
				i18nType: 'note.not_found',
			});
		}

		return note;
	}

	/**
	 * Lists all notes for an agent with pagination.
	 */
	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<Note>> {
		const startTime = Date.now();

		const result = await this.noteRepo.findByAgentId(agentId, query, selection);

		const duration = Date.now() - startTime;
		this.logger.debug(`Fetched ${result.items.length} notes for agent ${agentId} in ${duration}ms`);

		return result;
	}
}
