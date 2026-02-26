import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NoteEntity, AgentNoteEntity } from '@exprealty/database';
import type { Note, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { INoteRepository } from './ports/note.repository.port.js';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * TypeORM adapter implementing INoteRepository port.
 * @public
 */
@Injectable()
export class NoteTypeOrmRepository implements INoteRepository {
	constructor(
		@InjectRepository(NoteEntity)
		private readonly noteRepo: Repository<NoteEntity>,
		@InjectRepository(AgentNoteEntity)
		private readonly agentNoteRepo: Repository<AgentNoteEntity>,
		private readonly dataSource: DataSource,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('NoteRepository');
	}

	/**
	 * Maps a TypeORM NoteEntity to a domain Note type.
	 */
	private mapToDomain(entity: NoteEntity): Note {
		return {
			id: entity.id,
			body: entity.body,
			createdBy: entity.createdBy,
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
		} as Note;
	}

	async create(agentId: string, data: { body: string; createdBy?: string }): Promise<Note> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const noteEntity = queryRunner.manager.create(NoteEntity, {
				body: data.body,
				createdBy: data.createdBy ?? 'system',
			});
			const savedNote = await queryRunner.manager.save(noteEntity);

			const agentNote = queryRunner.manager.create(AgentNoteEntity, {
				agentId,
				noteId: savedNote.id,
			});
			await queryRunner.manager.save(agentNote);

			await queryRunner.commitTransaction();

			return this.mapToDomain(savedNote);
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	async update(agentId: string, noteId: string, data: { body?: string; modifiedBy?: string }): Promise<Note | null> {
		const agentNote = await this.agentNoteRepo.findOne({
			where: { agentId, noteId },
			relations: ['note'],
		});

		if (!agentNote?.note) return null;

		if (data.body !== undefined) agentNote.note.body = data.body;
		if (data.modifiedBy !== undefined) agentNote.note.modifiedBy = data.modifiedBy;

		const saved = await this.noteRepo.save(agentNote.note);
		return this.mapToDomain(saved);
	}

	async findByIdForAgent(agentId: string, noteId: string): Promise<Note | null> {
		const agentNote = await this.agentNoteRepo.findOne({
			where: { agentId, noteId },
			relations: ['note'],
		});

		if (!agentNote?.note) return null;

		return this.mapToDomain(agentNote.note);
	}

	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		_selection?: FieldSelection,
	): Promise<PageResult<Note>> {
		const offset = query?.offset ?? 0;
		const limit = Math.min(query?.limit ?? 25, 50);

		const qb = this.agentNoteRepo
			.createQueryBuilder('an')
			.innerJoinAndSelect('an.note', 'note')
			.where('an.agent_id = :agentId', { agentId })
			.orderBy('note.created', 'DESC')
			.skip(offset)
			.take(limit);

		const [agentNotes, total] = await qb.getManyAndCount();

		return {
			items: agentNotes
				.filter((an) => an.note != null)
				.map((an) => this.mapToDomain(an.note!)),
			total,
		};
	}
}
