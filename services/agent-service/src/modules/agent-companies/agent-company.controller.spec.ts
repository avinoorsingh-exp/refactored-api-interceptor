import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentCompanyController } from './agent-company.controller.js';
import { AgentCompanyService } from './agent-company.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { AgentCompany, CreateAgentCompanyInput, UpdateAgentCompanyInput } from '@exprealty/shared-domain';
import type { Response } from 'express';
import { LoggerService } from '../../core/logger.service.js';

/**
 * Unit tests for AgentCompanyController
 * Tests all endpoints: GET (list), GET/:id, POST, PUT/:id
 */
describe('AgentCompanyController', () => {
	let controller: AgentCompanyController;
	let service: jest.Mocked<AgentCompanyService>;

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

	const mockResponse = () => {
		const res: Partial<Response> = {
			setHeader: jest.fn(),
			status: jest.fn().mockReturnThis(),
		};
		return res as Response;
	};

	beforeEach(async () => {
		const mockService = {
			findPage: jest.fn(),
			findById: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [AgentCompanyController],
			providers: [
				{
					provide: AgentCompanyService,
					useValue: mockService,
				},
				{
					provide: LoggerService,
					useValue: {
						setContext: jest.fn(),
						info: jest.fn(),
						debug: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<AgentCompanyController>(AgentCompanyController);
		service = module.get(AgentCompanyService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /v1/agent-companies (findAll)', () => {
		it('should return paginated companies', async () => {
			const mockCompanies = [mockAgentCompany];
			service.findPage.mockResolvedValue({
				items: mockCompanies,
				total: 1,
			});

			const result = await controller.findAll({ offset: 0, limit: 25 });

			expect(result).toEqual({
				items: mockCompanies,
				total: 1,
			});
			expect(service.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 });
		});

		it('should return empty array when no companies', async () => {
			service.findPage.mockResolvedValue({
				items: [],
				total: 0,
			});

			const result = await controller.findAll({});

			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
		});

		it('should pass query parameters to service', async () => {
			service.findPage.mockResolvedValue({
				items: [],
				total: 0,
			});

			const query = { offset: 10, limit: 50, sort: 'name:asc' };
			await controller.findAll(query);

			expect(service.findPage).toHaveBeenCalledWith(query);
		});
	});

	describe('GET /v1/agent-companies/:id (findById)', () => {
		it('should return company when found', async () => {
			service.findById.mockResolvedValue(mockAgentCompany);

			const result = await controller.findById({ id: mockAgentCompany.id });

			expect(result).toEqual(mockAgentCompany);
			expect(service.findById).toHaveBeenCalledWith(mockAgentCompany.id);
		});

		it('should propagate NotFoundException from service', async () => {
			service.findById.mockRejectedValue(
				new NotFoundException({
					message: 'Agent company with id \'non-existent\' not found',
					i18nType: 'agent.company.not_found',
				}),
			);

			await expect(controller.findById({ id: 'non-existent' })).rejects.toThrow(NotFoundException);
		});
	});

	describe('POST /v1/agent-companies (create)', () => {
		const createDto: CreateAgentCompanyInput = {
			legacyId: '12345',
			name: 'Test Brokerage LLC',
			email: 'brokerage@example.com',
			phone: '5551234567',
			useSsn: false,
		} as CreateAgentCompanyInput;

		it('should create company and set Location header', async () => {
			service.create.mockResolvedValue(mockAgentCompany);
			const res = mockResponse();

			const result = await controller.create(createDto, res);

			expect(result).toEqual(mockAgentCompany);
			expect(service.create).toHaveBeenCalledWith(createDto);
			expect(res.setHeader).toHaveBeenCalledWith(
				'Location',
				`/v1/agent-companies/${mockAgentCompany.id}`,
			);
		});

		it('should propagate ConflictException for duplicate name', async () => {
			service.create.mockRejectedValue(
				new ConflictException({
					message: 'An agent company with name \'Test Brokerage LLC\' already exists',
					i18nType: 'agent.company.duplicate_name',
				}),
			);
			const res = mockResponse();

			await expect(controller.create(createDto, res)).rejects.toThrow(ConflictException);
		});
	});

	describe('PUT /v1/agent-companies/:id (update)', () => {
		const updateDto: UpdateAgentCompanyInput = {
			name: 'Updated Brokerage Name',
			phone: '5559999999',
		} as UpdateAgentCompanyInput;

		it('should update company successfully', async () => {
			const updatedCompany = { ...mockAgentCompany, ...updateDto };
			service.update.mockResolvedValue(updatedCompany);

			const result = await controller.update({ id: mockAgentCompany.id }, updateDto);

			expect(result).toEqual(updatedCompany);
			expect(service.update).toHaveBeenCalledWith(mockAgentCompany.id, updateDto);
		});

		it('should propagate NotFoundException from service', async () => {
			service.update.mockRejectedValue(
				new NotFoundException({
					message: 'Agent company with id \'non-existent\' not found',
					i18nType: 'agent.company.not_found',
				}),
			);

			await expect(controller.update({ id: 'non-existent' }, updateDto)).rejects.toThrow(NotFoundException);
		});

		it('should propagate ConflictException for duplicate name', async () => {
			service.update.mockRejectedValue(
				new ConflictException({
					message: 'An agent company with name \'Updated Brokerage Name\' already exists',
					i18nType: 'agent.company.duplicate_name',
				}),
			);

			await expect(controller.update({ id: mockAgentCompany.id }, updateDto)).rejects.toThrow(ConflictException);
		});
	});
});
