import { NotFoundException } from '@nestjs/common';
import { NoteService } from './note.service.js';
import type { INoteRepository } from './ports/note.repository.port.js';
import type { Note } from '@exprealty/shared-domain';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Unit tests for NoteService
 * Tests create(), findById(), findByAgentId() with mocked repository
 */
describe('NoteService', () => {
	let service: NoteService;
	let repository: jest.Mocked<INoteRepository>;
	let logger: jest.Mocked<LoggerService>;

	const mockAgentId = '550e8400-e29b-41d4-a716-446655440000';

	const mockNote: Note = {
		id: '660e8400-e29b-41d4-a716-446655440001',
		actor: 'admin@example.com',
		body: 'Agent completed onboarding process.',
		created: new Date('2026-02-20T10:00:00Z'),
		lastModified: new Date('2026-02-20T10:00:00Z'),
		modifiedBy: 'system',
	};

	beforeEach(() => {
		repository = {
			create: jest.fn(),
			findByIdForAgent: jest.fn(),
			findByAgentId: jest.fn(),
		} as jest.Mocked<INoteRepository>;

		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as unknown as jest.Mocked<LoggerService>;

		service = new NoteService(repository, logger);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('create', () => {
		const createDto = {
			actor: 'admin@example.com',
			body: 'Agent completed onboarding process.',
		};

		/**
		 * Test successful note creation
		 */
		it('should create a new note linked to the agent', async () => {
			repository.create.mockResolvedValue(mockNote);

			const result = await service.create(mockAgentId, createDto);

			expect(result).toEqual(mockNote);
			expect(repository.create).toHaveBeenCalledWith(mockAgentId, {
				actor: createDto.actor,
				body: createDto.body,
			});
		});

		/**
		 * Test that logger is called on successful creation
		 */
		it('should log successful creation with duration', async () => {
			repository.create.mockResolvedValue(mockNote);

			await service.create(mockAgentId, createDto);

			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Created note ${mockNote.id} for agent ${mockAgentId}`),
			);
		});

		/**
		 * Test error propagation from repository
		 */
		it('should propagate unexpected errors from repository', async () => {
			const error = new Error('Database connection failed');
			repository.create.mockRejectedValue(error);

			await expect(service.create(mockAgentId, createDto)).rejects.toThrow(error);
		});
	});

	describe('findById', () => {
		/**
		 * Test successful retrieval by ID
		 */
		it('should return note when found for agent', async () => {
			repository.findByIdForAgent.mockResolvedValue(mockNote);

			const result = await service.findById(mockAgentId, mockNote.id);

			expect(result).toEqual(mockNote);
			expect(repository.findByIdForAgent).toHaveBeenCalledWith(mockAgentId, mockNote.id);
		});

		/**
		 * Test not found scenario
		 */
		it('should throw NotFoundException when note not found', async () => {
			repository.findByIdForAgent.mockResolvedValue(null);

			await expect(service.findById(mockAgentId, 'non-existent-id')).rejects.toThrow(NotFoundException);
			await expect(service.findById(mockAgentId, 'non-existent-id')).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('non-existent-id'),
					i18nType: 'note.not_found',
				},
			});
		});

		/**
		 * Test note not linked to agent
		 */
		it('should throw NotFoundException when note exists but not linked to agent', async () => {
			repository.findByIdForAgent.mockResolvedValue(null);

			await expect(service.findById(mockAgentId, mockNote.id)).rejects.toThrow(NotFoundException);
			expect(repository.findByIdForAgent).toHaveBeenCalledWith(mockAgentId, mockNote.id);
		});

		/**
		 * Test error propagation
		 */
		it('should propagate unexpected errors from repository', async () => {
			const error = new Error('Database error');
			repository.findByIdForAgent.mockRejectedValue(error);

			await expect(service.findById(mockAgentId, mockNote.id)).rejects.toThrow(error);
		});
	});

	describe('findByAgentId', () => {
		/**
		 * Test paginated retrieval
		 */
		it('should return paginated notes from repository', async () => {
			const mockNotes = [
				mockNote,
				{ ...mockNote, id: 'another-id', body: 'Second note.' },
			];

			repository.findByAgentId.mockResolvedValue({
				items: mockNotes,
				total: 50,
			});

			const result = await service.findByAgentId(mockAgentId, { offset: 0, limit: 25 });

			expect(result.items).toEqual(mockNotes);
			expect(result.total).toBe(50);
			expect(repository.findByAgentId).toHaveBeenCalledWith(mockAgentId, { offset: 0, limit: 25 }, undefined);
		});

		/**
		 * Test pagination with offset
		 */
		it('should handle pagination offset correctly', async () => {
			repository.findByAgentId.mockResolvedValue({
				items: [mockNote],
				total: 50,
			});

			const result = await service.findByAgentId(mockAgentId, { offset: 25, limit: 25 });

			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(50);
			expect(repository.findByAgentId).toHaveBeenCalledWith(mockAgentId, { offset: 25, limit: 25 }, undefined);
		});

		/**
		 * Test empty result set
		 */
		it('should handle empty result set', async () => {
			repository.findByAgentId.mockResolvedValue({
				items: [],
				total: 0,
			});

			const result = await service.findByAgentId(mockAgentId, { offset: 0, limit: 25 });

			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
		});

		/**
		 * Test error propagation
		 */
		it('should propagate errors from repository', async () => {
			const error = new Error('Database error');
			repository.findByAgentId.mockRejectedValue(error);

			await expect(service.findByAgentId(mockAgentId, { offset: 0, limit: 25 })).rejects.toThrow(error);
		});
	});
});
