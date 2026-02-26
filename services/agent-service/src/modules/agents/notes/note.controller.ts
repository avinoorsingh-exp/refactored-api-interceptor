import {
	Controller,
	Get,
	Post,
	Put,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	Res,
	UseInterceptors,
	UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import { z } from 'zod';
import { CreateNoteInputSchema, UpdateNoteInputSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { NoteService } from './note.service.js';
import { NoteResponseDto, CreateNoteDto, UpdateNoteDto } from './dto/index.js';
import { PaginationInterceptor } from '../../../common/pagination/pagination.interceptor.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import { Agent } from '../../../common/decorators/agent.decorator.js';
import type { Agent as AgentType } from '@exprealty/shared-domain';

/**
 * UUID validation schema for note ID.
 */
const NoteIdSchema = z.string().uuid({ message: 'errors.note.id.invalid' });

/**
 * Controller for Note nested endpoints under Agent.
 * Routes: GET/POST /v1/agents/:id/notes
 *
 * Uses AgentExistsGuard to validate agent exists before processing.
 * The validated agent is available via @Agent() decorator.
 */
@ApiTags('agents > notes')
@Controller('v1/agents/:id/notes')
@UseGuards(AgentExistsGuard)
export class NoteController {
	constructor(
		private readonly noteService: NoteService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('NoteController');
	}

	/**
	 * Lists notes for an agent with pagination.
	 * GET /v1/agents/:id/notes
	 */
	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({
		summary: 'List notes for an agent',
		description: 'Returns a paginated list of notes for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiQuery({
		name: 'offset',
		required: false,
		type: Number,
		description: 'Pagination offset (default: 0)',
		example: 0,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Pagination limit (max: 50, default: 25)',
		example: 25,
	})
	@ApiResponse({
		status: 200,
		description: 'List of notes with pagination',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findAll(
		@Agent() agent: AgentType,
		@Query() query: { offset?: number; limit?: number },
	): Promise<{ items: NoteResponseDto[]; total: number }> {
		const result = await this.noteService.findByAgentId(agent.id, {
			offset: query.offset ?? 0,
			limit: query.limit ?? 25,
		});

		return {
			items: result.items as unknown as NoteResponseDto[],
			total: result.total,
		};
	}

	/**
	 * Gets a specific note by ID.
	 * GET /v1/agents/:id/notes/:noteId
	 */
	@Get(':noteId')
	@ApiOperation({
		summary: 'Get a note by ID',
		description: 'Returns a single note for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'noteId',
		type: 'string',
		description: 'Note UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiResponse({
		status: 200,
		description: 'Note found',
		type: NoteResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or note not found',
	})
	async findById(
		@Agent() agent: AgentType,
		@Param('noteId', new ZodValidationPipe(NoteIdSchema, 'note.validation'))
		noteId: string,
	): Promise<NoteResponseDto> {
		return this.noteService.findById(agent.id, noteId) as unknown as Promise<NoteResponseDto>;
	}

	/**
	 * Creates a new note for an agent.
	 * POST /v1/agents/:id/notes
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a note',
		description: 'Creates a new note for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiBody({
		type: CreateNoteDto,
		description: 'Note data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Note created successfully',
		type: NoteResponseDto,
		headers: {
			Location: {
				description: 'URL of the created note',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async create(
		@Agent() agent: AgentType,
		@Body(new ZodValidationPipe(CreateNoteInputSchema, 'note.validation'))
		body: CreateNoteDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<NoteResponseDto> {
		this.logger.operational(`Creating note for agent ${agent.id}`);

		const note = await this.noteService.create(agent.id, body);

		res.setHeader('Location', `/v1/agents/${agent.id}/notes/${note.id}`);

		return note as unknown as NoteResponseDto;
	}

	/**
	 * Updates a note for an agent.
	 * PUT /v1/agents/:id/notes/:noteId
	 */
	@Put(':noteId')
	@ApiOperation({
		summary: 'Update a note',
		description: 'Updates an existing note for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'noteId',
		type: 'string',
		description: 'Note UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiBody({
		type: UpdateNoteDto,
		description: 'Note data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Note updated successfully',
		type: NoteResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or note not found',
	})
	async update(
		@Agent() agent: AgentType,
		@Param('noteId', new ZodValidationPipe(NoteIdSchema, 'note.validation'))
		noteId: string,
		@Body(new ZodValidationPipe(UpdateNoteInputSchema, 'note.validation'))
		body: UpdateNoteDto,
	): Promise<NoteResponseDto> {
		this.logger.operational(`Updating note ${noteId} for agent ${agent.id}`);

		const note = await this.noteService.update(agent.id, noteId, body);

		return note as unknown as NoteResponseDto;
	}
}
