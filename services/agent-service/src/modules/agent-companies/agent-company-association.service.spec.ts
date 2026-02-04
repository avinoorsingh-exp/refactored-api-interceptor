import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentCompanyAssociationService } from './agent-company-association.service.js';
import type { IAgentCompanyAssociationRepository } from './ports/agent-company-association.repository.port.js';
import type { 
	AgentCompanyAssociation, 
	CreateAgentCompanyAssociationInput, 
	UpdateAgentCompanyAssociationInput 
} from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for AgentCompanyAssociationService
 * Tests CRUD operations and business rules for agent-company associations
 * Coverage: create, findById, findByAgentId, findPage, update, delete
 */
describe('AgentCompanyAssociationService', () => {
	let service: AgentCompanyAssociationService;
	let repository: jest.Mocked<IAgentCompanyAssociationRepository>;
	let logger: jest.Mocked<LoggerService>;

	const agentId = '70d049b4-4780-4e4f-9a7b-469d600b2d38';
	const agentCompanyId = '6e3cc17b-42e0-48db-9891-2d2a6182f9cc';

	const mockAssociation: AgentCompanyAssociation = {
		id: '2dde3649-c21d-4acd-b86e-3cfda9f9cdd6',
		agentId,
		agentCompanyId,
		isPrimary: true,
	} as AgentCompanyAssociation;

	beforeEach(() => {
		repository = {
			findById: jest.fn(),
			findByAgentId: jest.fn(),
			findByAgentAndCompany: jest.fn(),
			findPage: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			clearPrimaryForAgent: jest.fn(),
		} as unknown as jest.Mocked<IAgentCompanyAssociationRepository>;

		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as unknown as jest.Mocked<LoggerService>;

		service = new AgentCompanyAssociationService(repository, logger);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('create', () => {
		const createDto: CreateAgentCompanyAssociationInput = {
			agentCompanyId,
			isPrimary: false,
		} as CreateAgentCompanyAssociationInput;

		it('should create a new association successfully', async () => {
			const expectedAssoc = { ...mockAssociation, isPrimary: false };
			repository.findByAgentAndCompany.mockResolvedValue(null);
			repository.create.mockResolvedValue(expectedAssoc);

			const result = await service.create(agentId, createDto);

			expect(result).toEqual(expectedAssoc);
			expect(repository.findByAgentAndCompany).toHaveBeenCalledWith(agentId, agentCompanyId);
			expect(repository.create).toHaveBeenCalledWith({
				agentId,
				agentCompanyId,
				isPrimary: false,
			});
			expect(logger.info).toHaveBeenCalled();
		});

		it('should create primary association and clear existing primary', async () => {
			const primaryDto = { ...createDto, isPrimary: true };
			repository.findByAgentAndCompany.mockResolvedValue(null);
			repository.clearPrimaryForAgent.mockResolvedValue(undefined);
			repository.create.mockResolvedValue(mockAssociation);

			const result = await service.create(agentId, primaryDto);

			expect(result).toEqual(mockAssociation);
			expect(repository.clearPrimaryForAgent).toHaveBeenCalledWith(agentId);
			expect(repository.create).toHaveBeenCalled();
		});

		it('should throw ConflictException when association already exists', async () => {
			repository.findByAgentAndCompany.mockResolvedValue(mockAssociation);

			await expect(service.create(agentId, createDto)).rejects.toThrow(ConflictException);
			expect(repository.create).not.toHaveBeenCalled();
		});

		it('should propagate errors from repository', async () => {
			repository.findByAgentAndCompany.mockResolvedValue(null);
			const error = new Error('Database connection failed');
			repository.create.mockRejectedValue(error);

			await expect(service.create(agentId, createDto)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('findById', () => {
		it('should return association when found by ID', async () => {
			repository.findById.mockResolvedValue(mockAssociation);

			const result = await service.findById(mockAssociation.id);

			expect(result).toEqual(mockAssociation);
			expect(repository.findById).toHaveBeenCalledWith(mockAssociation.id);
			expect(logger.debug).toHaveBeenCalled();
		});

		it('should throw NotFoundException when association not found', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
			expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
		});

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error');
			repository.findById.mockRejectedValue(error);

			await expect(service.findById('some-id')).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('findByAgentId', () => {
		it('should return associations for agent', async () => {
			const associations = [mockAssociation];
			repository.findByAgentId.mockResolvedValue(associations);

			const result = await service.findByAgentId(agentId);

			expect(result).toEqual(associations);
			expect(repository.findByAgentId).toHaveBeenCalledWith(agentId);
		});

		it('should return empty array when no associations', async () => {
			repository.findByAgentId.mockResolvedValue([]);

			const result = await service.findByAgentId(agentId);

			expect(result).toEqual([]);
		});
	});

	describe('findPage', () => {
		it('should return paginated results from repository', async () => {
			const pageResult = {
				items: [mockAssociation],
				total: 1,
			};
			repository.findPage.mockResolvedValue(pageResult);

			const query = { offset: 0, limit: 25 };
			const result = await service.findPage(query);

			expect(result).toEqual(pageResult);
			expect(repository.findPage).toHaveBeenCalledWith(query, undefined);
		});

		it('should pass field selection to repository', async () => {
			const pageResult = { items: [], total: 0 };
			repository.findPage.mockResolvedValue(pageResult);

			const query = { offset: 0, limit: 25 };
			const selection = { fields: ['id', 'isPrimary'] };
			await service.findPage(query, selection as any);

			expect(repository.findPage).toHaveBeenCalledWith(query, selection);
		});
	});

	describe('update', () => {
		const updateDto: UpdateAgentCompanyAssociationInput = {
			isPrimary: true,
		} as UpdateAgentCompanyAssociationInput;

		it('should update association successfully', async () => {
			const existingAssoc = { ...mockAssociation, isPrimary: false };
			const updatedAssoc = { ...mockAssociation, isPrimary: true };
			repository.findById.mockResolvedValue(existingAssoc);
			repository.clearPrimaryForAgent.mockResolvedValue(undefined);
			repository.update.mockResolvedValue(updatedAssoc);

			const result = await service.update(mockAssociation.id, updateDto);

			expect(result).toEqual(updatedAssoc);
			expect(repository.clearPrimaryForAgent).toHaveBeenCalledWith(agentId);
			expect(repository.update).toHaveBeenCalledWith(mockAssociation.id, updateDto);
			expect(logger.info).toHaveBeenCalled();
		});

		it('should not clear primary when already primary', async () => {
			const existingAssoc = { ...mockAssociation, isPrimary: true };
			repository.findById.mockResolvedValue(existingAssoc);
			repository.update.mockResolvedValue(existingAssoc);

			await service.update(mockAssociation.id, updateDto);

			expect(repository.clearPrimaryForAgent).not.toHaveBeenCalled();
		});

		it('should not clear primary when not setting as primary', async () => {
			const existingAssoc = { ...mockAssociation, isPrimary: false };
			const updateNotPrimary = { isPrimary: false } as UpdateAgentCompanyAssociationInput;
			repository.findById.mockResolvedValue(existingAssoc);
			repository.update.mockResolvedValue(existingAssoc);

			await service.update(mockAssociation.id, updateNotPrimary);

			expect(repository.clearPrimaryForAgent).not.toHaveBeenCalled();
		});

		it('should throw NotFoundException when association not found', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
			expect(repository.update).not.toHaveBeenCalled();
		});

		it('should propagate errors from repository', async () => {
			repository.findById.mockResolvedValue(mockAssociation);
			const error = new Error('Database error');
			repository.update.mockRejectedValue(error);

			await expect(service.update(mockAssociation.id, updateDto)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('delete', () => {
		it('should delete association successfully', async () => {
			repository.findById.mockResolvedValue(mockAssociation);
			repository.delete.mockResolvedValue(undefined);

			await service.delete(mockAssociation.id);

			expect(repository.findById).toHaveBeenCalledWith(mockAssociation.id);
			expect(repository.delete).toHaveBeenCalledWith(mockAssociation.id);
			expect(logger.info).toHaveBeenCalled();
		});

		it('should throw NotFoundException when association not found', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
			expect(repository.delete).not.toHaveBeenCalled();
		});

		it('should propagate errors from repository', async () => {
			repository.findById.mockResolvedValue(mockAssociation);
			const error = new Error('Database error');
			repository.delete.mockRejectedValue(error);

			await expect(service.delete(mockAssociation.id)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
