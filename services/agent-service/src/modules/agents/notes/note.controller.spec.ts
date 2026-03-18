import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NoteController } from './note.controller.js';
import { NoteService } from './note.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { PaginationModule } from '../../../common/pagination/pagination.module.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import type { Note, Agent as AgentType } from '@exprealty/shared-domain';
import type { Response } from 'express';

/**
 * Unit tests for NoteController
 * Tests create(), findAll(), findById() with mocked service
 */
describe('NoteController', () => {
	let controller: NoteController;
	let service: jest.Mocked<NoteService>;

	const mockAgentId = '550e8400-e29b-41d4-a716-446655440000';

	const mockAgent: AgentType = {
		id: mockAgentId,
		agentId: '12345',
		firstName: 'John',
		lastName: 'Doe',
		lifecycleStatus: 'Active',
		seedAgent: false,
		isStaff: false,
		created: new Date(),
		lastModified: new Date(),
		modifiedBy: 'system',
	};

	const mockNote: Note = {
		id: '660e8400-e29b-41d4-a716-446655440001',
		body: 'Agent completed onboarding process.',
		createdBy: 'admin@example.com',
		created: new Date('2026-02-20T10:00:00Z'),
		lastModified: new Date('2026-02-20T10:00:00Z'),
		modifiedBy: 'system',
	};

	const mockResponse = () => {
		const res: Partial<Response> = {
			setHeader: jest.fn(),
			status: jest.fn().mockReturnThis(),
		};
		return res as Response;
	};

	beforeEach(async () => {
		const mockService = {
			create: jest.fn(),
			update: jest.fn(),
			findById: jest.fn(),
			findByAgentId: jest.fn(),
		};

		const mockChildLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			operational: jest.fn(),
			debugTiered: jest.fn(),
			critical: jest.fn(),
			lifecycle: jest.fn(),
		};

		const mockLogger = {
			createScopedLogger: jest.fn().mockReturnValue(mockChildLogger),
		};

		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [NoteController],
			providers: [
				{
					provide: NoteService,
					useValue: mockService,
				},
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
			],
		})
			.overrideGuard(AgentExistsGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = module.get<NoteController>(NoteController);
		service = module.get(NoteService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('POST /v1/agents/:id/notes (create)', () => {
		const createDto = {
			body: 'Agent completed onboarding process.',
			createdBy: 'admin@example.com',
		};

		/**
		 * Test successful note creation
		 */
		it('should create a new note successfully and set Location header', async () => {
			service.create.mockResolvedValue(mockNote);

			const res = mockResponse();
			const result = await controller.create(mockAgent, createDto, res);

			expect(result).toEqual(mockNote);
			expect(service.create).toHaveBeenCalledWith(mockAgentId, createDto);
			expect(res.setHeader).toHaveBeenCalledWith(
				'Location',
				`/v1/agents/${mockAgentId}/notes/${mockNote.id}`,
			);
		});

		/**
		 * Test generic error propagation
		 */
		it('should propagate unexpected errors from service', async () => {
			const error = new Error('Database connection failed');
			service.create.mockRejectedValue(error);

			const res = mockResponse();

			await expect(controller.create(mockAgent, createDto, res)).rejects.toThrow(error);
		});
	});

	describe('GET /v1/agents/:id/notes (findAll)', () => {
		/**
		 * Test paginated list retrieval
		 */
		it('should return paginated notes with total count', async () => {
			const mockNotes = [
				mockNote,
				{ ...mockNote, id: 'another-id', body: 'Second note.' },
				{ ...mockNote, id: 'third-id', body: 'Third note.' },
			];

			service.findByAgentId.mockResolvedValue({
				items: mockNotes,
				total: 50,
			});

			const result = await controller.findAll(mockAgent, { offset: 0, limit: 25 });

			expect(result).toEqual({
				items: mockNotes,
				total: 50,
			});
			expect(service.findByAgentId).toHaveBeenCalled();
		});

		/**
		 * Test pagination with offset
		 */
		it('should handle pagination offset correctly', async () => {
			const mockNotes = [{ ...mockNote, body: 'Page 2 note.' }];

			service.findByAgentId.mockResolvedValue({
				items: mockNotes,
				total: 50,
			});

			const result = await controller.findAll(mockAgent, { offset: 25, limit: 25 });

			expect(result.items).toEqual(mockNotes);
			expect(result.total).toBe(50);
		});

		/**
		 * Test empty result set
		 */
		it('should handle empty result set', async () => {
			service.findByAgentId.mockResolvedValue({
				items: [],
				total: 0,
			});

			const result = await controller.findAll(mockAgent, { offset: 0, limit: 25 });

			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
		});

		/**
		 * Test default pagination params (pipe provides defaults before handler)
		 */
		it('should use default pagination params when not provided', async () => {
			service.findByAgentId.mockResolvedValue({
				items: [mockNote],
				total: 1,
			});

			await controller.findAll(mockAgent, { offset: 0, limit: 25 });

			expect(service.findByAgentId).toHaveBeenCalledWith(
				mockAgentId,
				{ offset: 0, limit: 25 },
			);
		});
	});

	describe('GET /v1/agents/:id/notes/:noteId (findById)', () => {
		/**
		 * Test successful retrieval by ID
		 */
		it('should return a note when found by ID', async () => {
			service.findById.mockResolvedValue(mockNote);

			const result = await controller.findById(mockAgent, mockNote.id);

			expect(result).toEqual(mockNote);
			expect(service.findById).toHaveBeenCalledWith(mockAgentId, mockNote.id);
		});

		/**
		 * Test 404 not found scenario
		 */
		it('should throw NotFoundException when note not found', async () => {
			service.findById.mockRejectedValue(
				new NotFoundException({
					message: "Note with id 'non-existent-id' not found for agent",
					i18nType: 'note.not_found',
				}),
			);

			await expect(
				controller.findById(mockAgent, 'non-existent-id'),
			).rejects.toThrow(NotFoundException);

			expect(service.findById).toHaveBeenCalledWith(mockAgentId, 'non-existent-id');
		});

		/**
		 * Test error propagation
		 */
		it('should propagate unexpected errors from service', async () => {
			const error = new Error('Database error');
			service.findById.mockRejectedValue(error);

			await expect(
				controller.findById(mockAgent, mockNote.id),
			).rejects.toThrow(error);
		});
	});

	describe('PUT /v1/agents/:id/notes/:noteId (update)', () => {
		const updateDto = { body: 'Updated note body.', modifiedBy: 'editor@example.com' };

		it('should update a note successfully', async () => {
			const updatedNote = { ...mockNote, body: 'Updated note body.', modifiedBy: 'editor@example.com' };
			service.update.mockResolvedValue(updatedNote);

			const result = await controller.update(mockAgent, mockNote.id, updateDto);

			expect(result).toEqual(updatedNote);
			expect(service.update).toHaveBeenCalledWith(mockAgentId, mockNote.id, updateDto);
		});

		it('should throw NotFoundException when note not found', async () => {
			service.update.mockRejectedValue(
				new NotFoundException({
					message: "Note with id 'non-existent-id' not found for agent",
					i18nType: 'note.not_found',
				}),
			);

			await expect(
				controller.update(mockAgent, 'non-existent-id', updateDto),
			).rejects.toThrow(NotFoundException);
		});

		it('should propagate unexpected errors from service', async () => {
			const error = new Error('Database error');
			service.update.mockRejectedValue(error);

			await expect(
				controller.update(mockAgent, mockNote.id, updateDto),
			).rejects.toThrow(error);
		});
	});
});
