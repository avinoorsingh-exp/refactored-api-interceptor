import { ExternalReferenceTypeOrmRepository } from './external-reference.repository.js';
import { ExternalReferenceEntity, AgentExternalReferenceEntity } from '@exprealty/database';

describe('ExternalReferenceTypeOrmRepository', () => {
	let repository: ExternalReferenceTypeOrmRepository;
	let mockExtRefRepo: any;
	let mockJunctionRepo: any;
	let mockQueryRunner: any;
	let mockDataSource: any;

	beforeEach(() => {
		mockExtRefRepo = {
			save: jest.fn(),
			findOne: jest.fn(),
		};

		mockJunctionRepo = {
			findOne: jest.fn(),
			createQueryBuilder: jest.fn(),
		};

		mockQueryRunner = {
			connect: jest.fn(),
			startTransaction: jest.fn(),
			commitTransaction: jest.fn(),
			rollbackTransaction: jest.fn(),
			release: jest.fn(),
			manager: {
				create: jest.fn(),
				save: jest.fn(),
			},
		};

		mockDataSource = {
			createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
		};

		repository = new ExternalReferenceTypeOrmRepository(
			mockExtRefRepo,
			mockJunctionRepo,
			mockDataSource,
		);
	});

	describe('create()', () => {
		it('should create an external reference and junction in a transaction', async () => {
			const agentId = '550e8400-e29b-41d4-a716-446655440000';
			const savedEntity = {
				id: 'ref-001',
				systemCode: 'SALESFORCE',
				refKey: 'AccountId',
				refValue: '001D000000IqhSLIAZ',
				createdBy: 'admin',
				created: new Date(),
				lastModified: new Date(),
				modifiedBy: 'system',
			};

			mockQueryRunner.manager.create
				.mockReturnValueOnce(savedEntity)
				.mockReturnValueOnce({ agentId, externalReferenceId: savedEntity.id });
			mockQueryRunner.manager.save
				.mockResolvedValueOnce(savedEntity)
				.mockResolvedValueOnce({});

			const result = await repository.create(agentId, {
				systemCode: 'SALESFORCE',
				refKey: 'AccountId',
				refValue: '001D000000IqhSLIAZ',
				createdBy: 'admin',
			});

			expect(mockQueryRunner.connect).toHaveBeenCalled();
			expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.release).toHaveBeenCalled();
			expect(result.id).toBe('ref-001');
			expect(result.systemCode).toBe('SALESFORCE');
		});

		it('should rollback transaction on error', async () => {
			mockQueryRunner.manager.create.mockReturnValue({});
			mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

			await expect(
				repository.create('agent-1', {
					systemCode: 'X',
					refKey: 'K',
					refValue: 'V',
				}),
			).rejects.toThrow('DB error');

			expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
			expect(mockQueryRunner.release).toHaveBeenCalled();
		});
	});

	describe('update()', () => {
		it('should update an external reference via junction lookup', async () => {
			const entity = {
				id: 'ref-001',
				systemCode: 'OLD',
				refKey: 'Key',
				refValue: 'Val',
				createdBy: 'system',
				created: new Date(),
				lastModified: new Date(),
				modifiedBy: 'system',
			};

			mockJunctionRepo.findOne.mockResolvedValue({
				agentId: 'agent-1',
				externalReferenceId: 'ref-001',
				externalReference: entity,
			});

			const updated = { ...entity, systemCode: 'SALESFORCE', modifiedBy: 'admin' };
			mockExtRefRepo.save.mockResolvedValue(updated);

			const result = await repository.update('agent-1', 'ref-001', {
				systemCode: 'SALESFORCE',
				modifiedBy: 'admin',
			});

			expect(result).not.toBeNull();
			expect(result!.systemCode).toBe('SALESFORCE');
		});

		it('should return null when junction not found', async () => {
			mockJunctionRepo.findOne.mockResolvedValue(null);

			const result = await repository.update('agent-1', 'ref-999', { refValue: 'new' });

			expect(result).toBeNull();
		});
	});

	describe('findByIdForAgent()', () => {
		it('should return the external reference when found', async () => {
			const entity = {
				id: 'ref-001',
				systemCode: 'MENDIX',
				refKey: 'LegacyId',
				refValue: '12345',
				createdBy: 'system',
				created: new Date(),
				lastModified: new Date(),
				modifiedBy: 'system',
			};

			mockJunctionRepo.findOne.mockResolvedValue({
				externalReference: entity,
			});

			const result = await repository.findByIdForAgent('agent-1', 'ref-001');

			expect(result).not.toBeNull();
			expect(result!.refKey).toBe('LegacyId');
		});

		it('should return null when not found', async () => {
			mockJunctionRepo.findOne.mockResolvedValue(null);

			const result = await repository.findByIdForAgent('agent-1', 'ref-999');

			expect(result).toBeNull();
		});
	});

	describe('findByAgentId()', () => {
		it('should return paginated results', async () => {
			const entities = [
				{
					externalReference: {
						id: 'ref-001', systemCode: 'SF', refKey: 'K1', refValue: 'V1',
						createdBy: 'system', created: new Date(), lastModified: new Date(), modifiedBy: 'system',
					},
				},
				{
					externalReference: {
						id: 'ref-002', systemCode: 'MX', refKey: 'K2', refValue: 'V2',
						createdBy: 'system', created: new Date(), lastModified: new Date(), modifiedBy: 'system',
					},
				},
			];

			const mockQb = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([entities, 2]),
			};
			mockJunctionRepo.createQueryBuilder.mockReturnValue(mockQb);

			const result = await repository.findByAgentId('agent-1', { offset: 0, limit: 25 });

			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.items[0].systemCode).toBe('SF');
		});
	});
});
