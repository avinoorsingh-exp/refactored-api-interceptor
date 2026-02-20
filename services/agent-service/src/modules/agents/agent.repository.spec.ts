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
});
