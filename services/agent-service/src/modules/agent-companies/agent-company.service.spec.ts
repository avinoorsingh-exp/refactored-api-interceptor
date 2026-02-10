import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentCompanyService } from './agent-company.service.js';
import type { IAgentCompanyRepository } from './ports/agent-company.repository.port.js';
import type { AgentCompany, CreateAgentCompanyInput, UpdateAgentCompanyInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for AgentCompanyService
 * Tests CRUD operations with mocked repository
 * Coverage: create, findById, findPage, update, delete
 */
describe('AgentCompanyService', () => {
	let service: AgentCompanyService;
	let repository: jest.Mocked<IAgentCompanyRepository>;
	let logger: jest.Mocked<LoggerService>;

	const mockAgentCompany: AgentCompany = {
		id: '6e3cc17b-42e0-48db-9891-2d2a6182f9cc',
		legacyId: '12345',
		name: 'Test Brokerage LLC',
		email: 'brokerage@example.com',
		phone: '5551234567',
		taxId: '*****6789',
		taxIdHashed: null,
		useSsn: false,
		createdAt: new Date('2024-01-15T10:30:00Z'),
		updatedAt: new Date('2024-01-15T14:45:00Z'),
	} as AgentCompany;

	beforeEach(() => {
		repository = {
			findById: jest.fn(),
			findByName: jest.fn(),
			findPage: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		} as unknown as jest.Mocked<IAgentCompanyRepository>;

		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as unknown as jest.Mocked<LoggerService>;

		service = new AgentCompanyService(repository, logger);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('create', () => {
		const createDto: CreateAgentCompanyInput = {
			legacyId: '12345',
			name: 'Test Brokerage LLC',
			email: 'brokerage@example.com',
			phone: '5551234567',
			useSsn: false,
		} as CreateAgentCompanyInput;

		it('should create a new agent company successfully', async () => {
			repository.findByName.mockResolvedValue(null);
			repository.create.mockResolvedValue(mockAgentCompany);

			const result = await service.create(createDto);

			expect(result).toEqual(mockAgentCompany);
			expect(repository.findByName).toHaveBeenCalledWith('Test Brokerage LLC');
			expect(repository.create).toHaveBeenCalledWith(createDto);
			expect(logger.info).toHaveBeenCalled();
		});

		it('should throw ConflictException when company with same name exists', async () => {
			repository.findByName.mockResolvedValue(mockAgentCompany);

			await expect(service.create(createDto)).rejects.toThrow(ConflictException);
			expect(repository.findByName).toHaveBeenCalledWith('Test Brokerage LLC');
			expect(repository.create).not.toHaveBeenCalled();
		});

		it('should propagate errors from repository', async () => {
			repository.findByName.mockResolvedValue(null);
			const error = new Error('Database connection failed');
			repository.create.mockRejectedValue(error);

			await expect(service.create(createDto)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('findById', () => {
		it('should return company when found by ID', async () => {
			repository.findById.mockResolvedValue(mockAgentCompany);

			const result = await service.findById('6e3cc17b-42e0-48db-9891-2d2a6182f9cc');

			expect(result).toEqual(mockAgentCompany);
			expect(repository.findById).toHaveBeenCalledWith('6e3cc17b-42e0-48db-9891-2d2a6182f9cc');
			expect(logger.debug).toHaveBeenCalled();
		});

		it('should throw NotFoundException when company not found', async () => {
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

	describe('findPage', () => {
		it('should return paginated results from repository', async () => {
			const pageResult = {
				items: [mockAgentCompany],
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
			const selection = { fields: ['id', 'name'] };
			await service.findPage(query, selection as any);

			expect(repository.findPage).toHaveBeenCalledWith(query, selection);
		});
	});

	describe('update', () => {
		const updateDto: UpdateAgentCompanyInput = {
			name: 'Updated Brokerage Name',
			phone: '5559999999',
		} as UpdateAgentCompanyInput;

		it('should update company successfully', async () => {
			const updatedCompany = { ...mockAgentCompany, ...updateDto };
			repository.findById.mockResolvedValue(mockAgentCompany);
			repository.findByName.mockResolvedValue(null);
			repository.update.mockResolvedValue(updatedCompany);

			const result = await service.update('6e3cc17b-42e0-48db-9891-2d2a6182f9cc', updateDto);

			expect(result).toEqual(updatedCompany);
			expect(repository.findById).toHaveBeenCalledWith('6e3cc17b-42e0-48db-9891-2d2a6182f9cc');
			expect(repository.update).toHaveBeenCalledWith('6e3cc17b-42e0-48db-9891-2d2a6182f9cc', updateDto);
			expect(logger.info).toHaveBeenCalled();
		});

		it('should throw NotFoundException when company not found', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
			expect(repository.update).not.toHaveBeenCalled();
		});

		it('should throw ConflictException when changing to existing name', async () => {
			const anotherCompany = { ...mockAgentCompany, id: 'other-id', name: 'Updated Brokerage Name' };
			repository.findById.mockResolvedValue(mockAgentCompany);
			repository.findByName.mockResolvedValue(anotherCompany);

			await expect(service.update('6e3cc17b-42e0-48db-9891-2d2a6182f9cc', updateDto)).rejects.toThrow(ConflictException);
			expect(repository.update).not.toHaveBeenCalled();
		});

		it('should allow update without name change', async () => {
			const updateWithoutName: UpdateAgentCompanyInput = { phone: '5559999999' } as UpdateAgentCompanyInput;
			const updatedCompany = { ...mockAgentCompany, phone: '5559999999' };
			repository.findById.mockResolvedValue(mockAgentCompany);
			repository.update.mockResolvedValue(updatedCompany);

			const result = await service.update('6e3cc17b-42e0-48db-9891-2d2a6182f9cc', updateWithoutName);

			expect(result).toEqual(updatedCompany);
			expect(repository.findByName).not.toHaveBeenCalled();
		});

		it('should allow keeping same name', async () => {
			const updateWithSameName: UpdateAgentCompanyInput = { name: 'Test Brokerage LLC' } as UpdateAgentCompanyInput;
			const updatedCompany = { ...mockAgentCompany };
			repository.findById.mockResolvedValue(mockAgentCompany);
			repository.update.mockResolvedValue(updatedCompany);

			const result = await service.update('6e3cc17b-42e0-48db-9891-2d2a6182f9cc', updateWithSameName);

			expect(result).toEqual(updatedCompany);
			expect(repository.findByName).not.toHaveBeenCalled();
		});

		it('should propagate errors from repository', async () => {
			repository.findById.mockResolvedValue(mockAgentCompany);
			repository.findByName.mockResolvedValue(null);
			const error = new Error('Database error');
			repository.update.mockRejectedValue(error);

			await expect(service.update('6e3cc17b-42e0-48db-9891-2d2a6182f9cc', updateDto)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('delete', () => {
		it('should delete company successfully', async () => {
			repository.findById.mockResolvedValue(mockAgentCompany);
			repository.delete.mockResolvedValue(undefined);

			await service.delete('6e3cc17b-42e0-48db-9891-2d2a6182f9cc');

			expect(repository.findById).toHaveBeenCalledWith('6e3cc17b-42e0-48db-9891-2d2a6182f9cc');
			expect(repository.delete).toHaveBeenCalledWith('6e3cc17b-42e0-48db-9891-2d2a6182f9cc');
			expect(logger.info).toHaveBeenCalled();
		});

		it('should throw NotFoundException when company not found', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
			expect(repository.delete).not.toHaveBeenCalled();
		});

		it('should propagate errors from repository', async () => {
			repository.findById.mockResolvedValue(mockAgentCompany);
			const error = new Error('Database error');
			repository.delete.mockRejectedValue(error);

			await expect(service.delete('6e3cc17b-42e0-48db-9891-2d2a6182f9cc')).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
