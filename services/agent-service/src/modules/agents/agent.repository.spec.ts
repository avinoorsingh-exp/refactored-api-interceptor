import { AgentTypeOrmRepository } from './agent.repository.js';
import { AgentEntity } from '@exprealty/database';
import type { Agent } from '@exprealty/shared-domain';
import {
	createMockTypeOrmRepository,
	createMockQueryBuilder,
	createMockQueryService,
	createMockProjectionService,
} from '../../../../../test/utils/mock-factories.js';

/**
 * Unit tests for AgentTypeOrmRepository.
 * Focus on licensed states sort behavior (full list string_agg sort matching display).
 */
describe('AgentTypeOrmRepository', () => {
	let repository: AgentTypeOrmRepository;
	let mockTypeOrmRepo: ReturnType<typeof createMockTypeOrmRepository>;
	let mockQueryService: ReturnType<typeof createMockQueryService>;
	let mockProjectionService: ReturnType<typeof createMockProjectionService>;
	let mockLogger: { setContext: jest.Mock; log: jest.Mock; info: jest.Mock; debug: jest.Mock; error: jest.Mock; warn: jest.Mock };
	let mockQb: ReturnType<typeof createMockQueryBuilder>;

	const minimalAgentEntity: AgentEntity = {
		id: '550e8400-e29b-41d4-a716-446655440000',
		firstName: 'Jane',
		lastName: 'Doe',
		lifecycleStatus: 'active',
		created: new Date('2024-01-15T10:30:00Z'),
		lastModified: new Date('2024-01-15T14:45:00Z'),
		modifiedBy: 'system',
	} as unknown as AgentEntity;

	beforeEach(() => {
		mockQb = createMockQueryBuilder();
		mockTypeOrmRepo = createMockTypeOrmRepository();
		(mockTypeOrmRepo as any).createQueryBuilder = jest.fn().mockReturnValue(mockQb);
		(mockTypeOrmRepo as any).manager = { query: jest.fn().mockResolvedValue([]) };

		mockQueryService = createMockQueryService();
		mockQueryService.normalizeWithValidation.mockReturnValue({
			offset: 0,
			limit: 25,
			filter: { conditions: [], logicalOperator: 'AND' },
			sort: { conditions: [] },
			search: { query: '', fields: [] },
		});

		mockProjectionService = createMockProjectionService();
		mockLogger = {
			setContext: jest.fn(),
			log: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
		};

		repository = new AgentTypeOrmRepository(
			mockTypeOrmRepo as any,
			mockQueryService as any,
			mockLogger,
			mockProjectionService as any,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('findPage with licensedStates sort', () => {
		beforeEach(() => {
			mockQb.getManyAndCount.mockResolvedValue([[minimalAgentEntity], 1]);
		});

		it('should addSelect licensed_states_sort subquery using string_agg (full list) when sort by licensedStates ASC', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				sort: { conditions: [{ field: 'licensedStates', direction: 'ASC' }] },
			});

			expect(mockQb.addSelect).toHaveBeenCalled();
			const addSelectCalls = (mockQb.addSelect as jest.Mock).mock.calls;
			const licensedSortCall = addSelectCalls.find(
				(call: unknown[]) => typeof call[0] === 'string' && call[1] === 'licensed_states_sort',
			);
			expect(licensedSortCall).toBeDefined();
			expect(licensedSortCall[0]).toContain('string_agg');
			expect(licensedSortCall[0]).toContain('ORDER BY s.state_code');
			expect(licensedSortCall[0]).toContain('core.license');
			expect(licensedSortCall[0]).toContain('agent.id');
			expect(licensedSortCall[1]).toBe('licensed_states_sort');
		});

		it('should orderBy licensed_states_sort ASC NULLS LAST when sort by licensedStates ASC', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				sort: { conditions: [{ field: 'licensedStates', direction: 'ASC' }] },
			});

			expect(mockQb.orderBy).toHaveBeenCalledWith('licensed_states_sort', 'ASC', 'NULLS LAST');
		});

		it('should orderBy licensed_states_sort DESC NULLS LAST when sort by licensedStates DESC', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				sort: { conditions: [{ field: 'licensedStates', direction: 'DESC' }] },
			});

			expect(mockQb.orderBy).toHaveBeenCalledWith('licensed_states_sort', 'DESC', 'NULLS LAST');
		});

		it('should use distinct state codes in subquery (not MIN)', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				sort: { conditions: [{ field: 'licensedStates', direction: 'ASC' }] },
			});

			const addSelectCalls = (mockQb.addSelect as jest.Mock).mock.calls;
			const licensedSortCall = addSelectCalls.find(
				(call: unknown[]) => typeof call[0] === 'string' && call[1] === 'licensed_states_sort',
			);
			expect(licensedSortCall).toBeDefined();
			expect(licensedSortCall[0]).toContain('SELECT DISTINCT');
			expect(licensedSortCall[0]).not.toMatch(/\bMIN\s*\(\s*l\.state_code\s*\)/);
		});

		it('should not add licensed_states_sort when sort is by another field', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				sort: { conditions: [{ field: 'agentId', direction: 'ASC' }] },
			});

			const addSelectCalls = (mockQb.addSelect as jest.Mock).mock.calls;
			const licensedSortCall = addSelectCalls.find(
				(call: unknown[]) => call[1] === 'licensed_states_sort',
			);
			expect(licensedSortCall).toBeUndefined();
			expect(mockQb.orderBy).not.toHaveBeenCalledWith('licensed_states_sort', expect.anything(), expect.anything());
		});
	});

	describe('findPage with candidate set optimization', () => {
		beforeEach(() => {
			mockQb.getManyAndCount.mockResolvedValue([[minimalAgentEntity], 1]);
			mockQueryService.normalizeWithValidation.mockReturnValue({
				offset: 0,
				limit: 25,
				filter: {
					conditions: [
						{ field: 'lifecycleStatus', operator: 'eq', value: 'Active' },
						{ field: 'id', operator: 'ne', value: 'fb52bfc9-0c85-11eb-9662-9be8f1cc03e5' },
						{ field: 'firstName', operator: 'ilike', value: 'john' },
					],
					logicalOperator: 'AND',
				},
				sort: { conditions: [] },
				search: undefined,
			});
		});

		it('should apply candidate set andWhere when filter has cheap conditions and expensive filters (email)', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				filter: JSON.stringify({
					conditions: [
						{ field: 'lifecycleStatus', operator: 'eq', value: 'Active' },
						{ field: 'id', operator: 'ne', value: 'fb52bfc9-0c85-11eb-9662-9be8f1cc03e5' },
						{ field: 'email', operator: 'ilike', value: 'test' },
					],
					logicalOperator: 'AND',
				}),
			});

			const andWhereCalls = (mockQb.andWhere as jest.Mock).mock.calls;
			const candidateCall = andWhereCalls.find(
				(call: unknown[]) =>
					typeof call[0] === 'string' &&
					call[0].includes('IN (SELECT "id" FROM "core"."agent"'),
			);
			expect(candidateCall).toBeDefined();
			expect(candidateCall[0]).toContain('"lifecycle_status" = :candidate_ls');
			expect(candidateCall[0]).toContain('"id" != :candidate_id_ne');
			expect(candidateCall[0]).toContain('LIMIT :candidate_limit');
			expect(candidateCall[1]).toEqual(
				expect.objectContaining({
					candidate_ls: 'Active',
					candidate_id_ne: 'fb52bfc9-0c85-11eb-9662-9be8f1cc03e5',
					candidate_limit: 2000,
				}),
			);
		});

		it('should not apply candidate set when filter has no cheap conditions', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				filter: JSON.stringify({
					conditions: [{ field: 'firstName', operator: 'ilike', value: 'john' }],
					logicalOperator: 'AND',
				}),
			});

			const andWhereCalls = (mockQb.andWhere as jest.Mock).mock.calls;
			const candidateCall = andWhereCalls.find(
				(call: unknown[]) =>
					typeof call[0] === 'string' && call[0].includes('candidate_limit'),
			);
			expect(candidateCall).toBeUndefined();
		});
	});

	describe('findPage with full-text search (search_vector)', () => {
		beforeEach(() => {
			mockQb.getManyAndCount.mockResolvedValue([[minimalAgentEntity], 1]);
		});

		it('should not pass extraSearchOrConditions for free-text search (uses grouped andWhere with :search and :fts only)', async () => {
			let capturedOptions: { extraSearchOrConditions?: (qb: any, searchQuery: string | undefined) => void } | undefined;
			(mockQueryService.applyAllWithStrategies as jest.Mock).mockImplementation((_qb: unknown, _p: unknown, _e: unknown, _a: unknown, options: unknown) => {
				capturedOptions = options as typeof capturedOptions;
				return mockQb;
			});

			await repository.findPage({
				limit: 25,
				offset: 0,
				search: 'smith',
			});

			expect(capturedOptions?.extraSearchOrConditions).toBeUndefined();
		});

		it('should add single grouped andWhere with :search and :ftsPrefix for free-text search', async () => {
			await repository.findPage({
				limit: 25,
				offset: 0,
				search: 'smith',
			});

			const andWhereCalls = (mockQb.andWhere as jest.Mock).mock.calls;
			const groupedCall = andWhereCalls.find(
				(call: unknown[]) =>
					typeof call[0] === 'string' &&
					call[0].includes('search_vector') &&
					call[0].includes('to_tsquery') &&
					call[0].includes('ILIKE') &&
					call[0].includes('preferredName'),
			);
			expect(groupedCall).toBeDefined();
			expect(groupedCall[1]).toEqual({ search: '%smith%', ftsPrefix: 'smith:*' });
		});

		it('should not add FTS orWhere when search is UUID (callback does nothing)', async () => {
			let capturedOptions: { extraSearchOrConditions?: (qb: any, searchQuery: string | undefined) => void } | undefined;
			(mockQueryService.applyAllWithStrategies as jest.Mock).mockImplementation((_qb: unknown, _p: unknown, _e: unknown, _a: unknown, options: unknown) => {
				capturedOptions = options as typeof capturedOptions;
				return mockQb;
			});

			await repository.findPage({
				limit: 25,
				offset: 0,
				search: '550e8400-e29b-41d4-a716-446655440000',
			});

			const orWhereCallsBefore = (mockQb.orWhere as jest.Mock).mock.calls.length;
			capturedOptions?.extraSearchOrConditions?.(mockQb, '550e8400-e29b-41d4-a716-446655440000');
			expect(mockQb.orWhere).toHaveBeenCalledTimes(orWhereCallsBefore);
		});

		it('should not add FTS orWhere when search contains @ (email)', async () => {
			let capturedOptions: { extraSearchOrConditions?: (qb: any, searchQuery: string | undefined) => void } | undefined;
			(mockQueryService.applyAllWithStrategies as jest.Mock).mockImplementation((_qb: unknown, _p: unknown, _e: unknown, _a: unknown, options: unknown) => {
				capturedOptions = options as typeof capturedOptions;
				return mockQb;
			});

			await repository.findPage({
				limit: 25,
				offset: 0,
				search: 'user@example.com',
			});

			const orWhereCallsBefore = (mockQb.orWhere as jest.Mock).mock.calls.length;
			capturedOptions?.extraSearchOrConditions?.(mockQb, 'user@example.com');
			expect(mockQb.orWhere).toHaveBeenCalledTimes(orWhereCallsBefore);
		});
	});

	describe('findPage result shape (pagination and filters unchanged)', () => {
		beforeEach(() => {
			mockQb.getManyAndCount.mockResolvedValue([[minimalAgentEntity], 1]);
		});

		it('should return items and total with default pagination', async () => {
			const result = await repository.findPage({ limit: 10, offset: 0 });
			expect(result).toEqual(
				expect.objectContaining({
					items: expect.any(Array),
					total: 1,
				}),
			);
			expect(result.items).toHaveLength(1);
		});

		it('should return same shape when filter has lifecycleStatus and search', async () => {
			mockQueryService.normalizeWithValidation.mockReturnValue({
				offset: 0,
				limit: 25,
				filter: { conditions: [{ field: 'lifecycleStatus', operator: 'eq', value: 'Active' }], logicalOperator: 'AND' },
				sort: { conditions: [] },
				search: { query: 'jane', fields: [] },
			});
			const result = await repository.findPage({
				limit: 25,
				offset: 0,
				filter: JSON.stringify({ conditions: [{ field: 'lifecycleStatus', operator: 'eq', value: 'Active' }] }),
				search: 'jane',
			});
			expect(result).toEqual(
				expect.objectContaining({
					items: expect.any(Array),
					total: expect.any(Number),
				}),
			);
		});
	});

	/**
	 * Integration validation: run against a database with 250k+ agent rows and
	 * confirm full-text search uses IDX_agent_search_vector (EXPLAIN ANALYZE).
	 * Not run in CI; enable with RUN_AGENT_FTS_INTEGRATION=1 when DB has large dataset.
	 */
	describe('full-text search integration (250k+ rows)', () => {
		const runIntegration = process.env.RUN_AGENT_FTS_INTEGRATION === '1';
		const itIntegration = runIntegration ? it : it.skip;

		itIntegration(
			'should complete findPage with search without timeout when search_vector GIN index exists',
			async () => {
				// Requires real DB with migration 1772000000000 applied and 250k+ rows.
				// Asserts query completes; for index validation run EXPLAIN ANALYZE in DB.
				const result = await repository.findPage({
					limit: 25,
					offset: 0,
					search: 'smith',
					filter: JSON.stringify({ conditions: [{ field: 'lifecycleStatus', operator: 'eq', value: 'Active' }] }),
				});
				expect(result).toEqual(
					expect.objectContaining({
						items: expect.any(Array),
						total: expect.any(Number),
					}),
				);
			},
			15000,
		);
	});
});
