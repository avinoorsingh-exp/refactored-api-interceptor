import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Note, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { INoteRepository } from './ports/note.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService, ScopedLogger } from '../../../core/logger.service.js';
import type { CreateNoteDto, UpdateNoteDto } from './dto/index.js';

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
	private readonly logger: ScopedLogger;

	constructor(
		@Inject('INoteRepository')
		private readonly noteRepo: INoteRepository,
		logger: LoggerService,
	) {
		this.logger = logger.createScopedLogger('NoteService');
	}

	/**
	 * Creates a new note for an agent.
	 */
	async create(agentId: string, data: CreateNoteDto): Promise<Note> {
		const startTime = Date.now();

		const note = await this.noteRepo.create(agentId, {
			body: data.body,
			createdBy: data.createdBy,
		});

		const duration = Date.now() - startTime;
		this.logger.operational(`Created note ${note.id} for agent ${agentId} in ${duration}ms`);

		return note;
	}

	/**
	 * Updates a note for an agent.
	 */
	async update(agentId: string, noteId: string, data: UpdateNoteDto): Promise<Note> {
		const startTime = Date.now();

		const note = await this.noteRepo.update(agentId, noteId, {
			body: data.body,
			modifiedBy: data.modifiedBy,
		});

		if (!note) {
			throw new NotFoundException({
				message: `Note with id '${noteId}' not found for agent '${agentId}'`,
				i18nType: 'note.not_found',
			});
		}

		const duration = Date.now() - startTime;
		this.logger.operational(`Updated note ${noteId} for agent ${agentId} in ${duration}ms`);

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
		this.logger.debugTiered(`Fetched ${result.items.length} notes for agent ${agentId} in ${duration}ms`);

		return result;
	}
}
