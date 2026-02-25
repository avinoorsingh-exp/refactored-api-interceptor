import { NoteTypeOrmRepository } from './note.repository.js';
import type { NoteEntity, AgentNoteEntity } from '@exprealty/database';

/**
 * Unit tests for NoteTypeOrmRepository
 * Tests create(), findByIdForAgent(), findByAgentId() with mocked TypeORM repos
 */
describe('NoteTypeOrmRepository', () => {
	let repository: NoteTypeOrmRepository;
	let mockNoteRepo: Record<string, jest.Mock>;
	let mockAgentNoteRepo: Record<string, jest.Mock>;
	let mockLogger: Record<string, jest.Mock>;

	const mockAgentId = '550e8400-e29b-41d4-a716-446655440000';
	const mockNoteId = '660e8400-e29b-41d4-a716-446655440001';

	const mockNoteEntity = {
		id: mockNoteId,
		actor: 'admin@example.com',
		body: 'Test note body.',
		created: new Date('2026-02-20T10:00:00Z'),
		lastModified: new Date('2026-02-20T10:00:00Z'),
		modifiedBy: 'system',
	} as NoteEntity;

	beforeEach(() => {
		mockNoteRepo = {
			create: jest.fn(),
			save: jest.fn(),
		};

		mockAgentNoteRepo = {
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
			createQueryBuilder: jest.fn(),
		};

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		};

		repository = new NoteTypeOrmRepository(
			mockNoteRepo as any,
			mockAgentNoteRepo as any,
			mockLogger as any,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should set logger context on construction', () => {
		expect(mockLogger.setContext).toHaveBeenCalledWith('NoteRepository');
	});

	describe('create', () => {
		const createData = { actor: 'admin@example.com', body: 'Test note body.' };

		it('should create a note entity and junction record', async () => {
			mockNoteRepo.create.mockReturnValue(mockNoteEntity);
			mockNoteRepo.save.mockResolvedValue(mockNoteEntity);
			mockAgentNoteRepo.create.mockReturnValue({
				agentId: mockAgentId,
				noteId: mockNoteId,
			});
			mockAgentNoteRepo.save.mockResolvedValue({
				id: 'junction-id',
				agentId: mockAgentId,
				noteId: mockNoteId,
			});

			const result = await repository.create(mockAgentId, createData);

			expect(mockNoteRepo.create).toHaveBeenCalledWith({
				actor: createData.actor,
				body: createData.body,
			});
			expect(mockNoteRepo.save).toHaveBeenCalledWith(mockNoteEntity);
			expect(mockAgentNoteRepo.create).toHaveBeenCalledWith({
				agentId: mockAgentId,
				noteId: mockNoteId,
			});
			expect(mockAgentNoteRepo.save).toHaveBeenCalled();
			expect(result).toEqual({
				id: mockNoteId,
				actor: 'admin@example.com',
				body: 'Test note body.',
				created: mockNoteEntity.created,
				lastModified: mockNoteEntity.lastModified,
				modifiedBy: 'system',
			});
		});

		it('should propagate errors from noteRepo.save', async () => {
			mockNoteRepo.create.mockReturnValue(mockNoteEntity);
			mockNoteRepo.save.mockRejectedValue(new Error('DB error'));

			await expect(repository.create(mockAgentId, createData)).rejects.toThrow('DB error');
		});
	});

	describe('findByIdForAgent', () => {
		it('should return mapped note when junction record exists', async () => {
			mockAgentNoteRepo.findOne.mockResolvedValue({
				agentId: mockAgentId,
				noteId: mockNoteId,
				note: mockNoteEntity,
			});

			const result = await repository.findByIdForAgent(mockAgentId, mockNoteId);

			expect(mockAgentNoteRepo.findOne).toHaveBeenCalledWith({
				where: { agentId: mockAgentId, noteId: mockNoteId },
				relations: ['note'],
			});
			expect(result).toEqual({
				id: mockNoteId,
				actor: 'admin@example.com',
				body: 'Test note body.',
				created: mockNoteEntity.created,
				lastModified: mockNoteEntity.lastModified,
				modifiedBy: 'system',
			});
		});

		it('should return null when junction record not found', async () => {
			mockAgentNoteRepo.findOne.mockResolvedValue(null);

			const result = await repository.findByIdForAgent(mockAgentId, mockNoteId);

			expect(result).toBeNull();
		});

		it('should return null when junction exists but note is null', async () => {
			mockAgentNoteRepo.findOne.mockResolvedValue({
				agentId: mockAgentId,
				noteId: mockNoteId,
				note: null,
			});

			const result = await repository.findByIdForAgent(mockAgentId, mockNoteId);

			expect(result).toBeNull();
		});
	});

	describe('findByAgentId', () => {
		const mockQb = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			skip: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn(),
		};

		beforeEach(() => {
			mockAgentNoteRepo.createQueryBuilder.mockReturnValue(mockQb);
		});

		it('should return paginated notes with default params', async () => {
			mockQb.getManyAndCount.mockResolvedValue([
				[{ note: mockNoteEntity }],
				1,
			]);

			const result = await repository.findByAgentId(mockAgentId);

			expect(mockAgentNoteRepo.createQueryBuilder).toHaveBeenCalledWith('an');
			expect(mockQb.innerJoinAndSelect).toHaveBeenCalledWith('an.note', 'note');
			expect(mockQb.where).toHaveBeenCalledWith('an.agent_id = :agentId', { agentId: mockAgentId });
			expect(mockQb.orderBy).toHaveBeenCalledWith('note.created', 'DESC');
			expect(mockQb.skip).toHaveBeenCalledWith(0);
			expect(mockQb.take).toHaveBeenCalledWith(25);
			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(1);
		});

		it('should apply custom offset and limit', async () => {
			mockQb.getManyAndCount.mockResolvedValue([[], 0]);

			await repository.findByAgentId(mockAgentId, { offset: 10, limit: 5 });

			expect(mockQb.skip).toHaveBeenCalledWith(10);
			expect(mockQb.take).toHaveBeenCalledWith(5);
		});

		it('should cap limit at 50', async () => {
			mockQb.getManyAndCount.mockResolvedValue([[], 0]);

			await repository.findByAgentId(mockAgentId, { limit: 100 });

			expect(mockQb.take).toHaveBeenCalledWith(50);
		});

		it('should filter out junction records with null notes', async () => {
			mockQb.getManyAndCount.mockResolvedValue([
				[
					{ note: mockNoteEntity },
					{ note: null },
				],
				2,
			]);

			const result = await repository.findByAgentId(mockAgentId);

			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(2);
		});

		it('should handle empty results', async () => {
			mockQb.getManyAndCount.mockResolvedValue([[], 0]);

			const result = await repository.findByAgentId(mockAgentId, { offset: 0, limit: 25 });

			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
		});
	});
});
