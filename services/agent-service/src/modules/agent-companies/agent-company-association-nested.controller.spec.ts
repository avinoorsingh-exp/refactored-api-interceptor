import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentCompanyAssociationNestedController } from './agent-company-association-nested.controller.js';
import { AgentCompanyAssociationService } from './agent-company-association.service.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import type { 
	AgentCompanyAssociation, 
	CreateAgentCompanyAssociationInput, 
	UpdateAgentCompanyAssociationInput,
	Agent as AgentType,
} from '@exprealty/shared-domain';
import type { Response } from 'express';
import { LoggerService } from '../../core/logger.service.js';
import { AgentExistsGuard } from '../../common/guards/agent-exists.guard.js';

/**
 * Unit tests for AgentCompanyAssociationNestedController
 * Tests all endpoints under /v1/agents/:id/agent-companies
 */
describe('AgentCompanyAssociationNestedController', () => {
	let controller: AgentCompanyAssociationNestedController;
	let service: jest.Mocked<AgentCompanyAssociationService>;

	const agentId = '70d049b4-4780-4e4f-9a7b-469d600b2d38';
	const agentCompanyId = '6e3cc17b-42e0-48db-9891-2d2a6182f9cc';

	const mockAgent: Partial<AgentType> = {
		id: agentId,
		firstName: 'John',
		lastName: 'Doe',
	};

	const mockAssociation: AgentCompanyAssociation = {
		id: '2dde3649-c21d-4acd-b86e-3cfda9f9cdd6',
		agentId,
		agentCompanyId,
		isPrimary: true,
	} as AgentCompanyAssociation;

	const mockResponse = () => {
		const res: Partial<Response> = {
			setHeader: jest.fn(),
			status: jest.fn().mockReturnThis(),
		};
		return res as Response;
	};

	beforeEach(async () => {
		const mockService = {
			findByAgentId: jest.fn(),
			findById: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [AgentCompanyAssociationNestedController],
			providers: [
				{
					provide: AgentCompanyAssociationService,
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
		})
			// Override the guard to always pass for unit testing
			.overrideGuard(AgentExistsGuard)
			.useValue({
				canActivate: jest.fn().mockReturnValue(true),
			})
			.compile();

		controller = module.get<AgentCompanyAssociationNestedController>(AgentCompanyAssociationNestedController);
		service = module.get(AgentCompanyAssociationService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /v1/agents/:id/agent-companies (findAll)', () => {
		it('should return associations for agent', async () => {
			const mockAssociations = [mockAssociation];
			service.findByAgentId.mockResolvedValue(mockAssociations);

			const result = await controller.findAll(mockAgent as AgentType);

			expect(result).toEqual(mockAssociations);
			expect(service.findByAgentId).toHaveBeenCalledWith(agentId);
		});

		it('should return empty array when no associations', async () => {
			service.findByAgentId.mockResolvedValue([]);

			const result = await controller.findAll(mockAgent as AgentType);

			expect(result).toEqual([]);
		});
	});

	describe('POST /v1/agents/:id/agent-companies (create)', () => {
		const createDto: CreateAgentCompanyAssociationInput = {
			agentCompanyId,
			isPrimary: false,
		} as CreateAgentCompanyAssociationInput;

		it('should create association and set Location header', async () => {
			service.create.mockResolvedValue(mockAssociation);
			const res = mockResponse();

			const result = await controller.create(mockAgent as AgentType, createDto, res);

			expect(result).toEqual(mockAssociation);
			expect(service.create).toHaveBeenCalledWith(agentId, createDto);
			expect(res.setHeader).toHaveBeenCalledWith(
				'Location',
				`/v1/agents/${agentId}/agent-companies/${mockAssociation.id}`,
			);
		});

		it('should propagate ConflictException for duplicate association', async () => {
			service.create.mockRejectedValue(
				new ConflictException({
					message: `Agent '${agentId}' is already associated with company '${agentCompanyId}'`,
					i18nType: 'agent.company_association.duplicate',
				}),
			);
			const res = mockResponse();

			await expect(controller.create(mockAgent as AgentType, createDto, res)).rejects.toThrow(ConflictException);
		});
	});

	describe('PUT /v1/agents/:id/agent-companies/:associationId (update)', () => {
		const updateDto: UpdateAgentCompanyAssociationInput = {
			isPrimary: true,
		} as UpdateAgentCompanyAssociationInput;

		it('should update association successfully', async () => {
			const updatedAssoc = { ...mockAssociation, isPrimary: true };
			service.findById.mockResolvedValue(mockAssociation);
			service.update.mockResolvedValue(updatedAssoc);

			const result = await controller.update(
				mockAgent as AgentType,
				mockAssociation.id,
				updateDto,
			);

			expect(result).toEqual(updatedAssoc);
			expect(service.update).toHaveBeenCalledWith(mockAssociation.id, updateDto);
		});

		it('should propagate NotFoundException when association not found', async () => {
			service.findById.mockRejectedValue(
				new NotFoundException({
					message: `Agent company association with id 'non-existent' not found`,
					i18nType: 'agent.company_association.not_found',
				}),
			);

			await expect(
				controller.update(
					mockAgent as AgentType,
					'non-existent',
					updateDto,
				),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw NotFoundException when association belongs to different agent', async () => {
			const otherAgentAssoc = { ...mockAssociation, agentId: 'other-agent-id' };
			service.findById.mockResolvedValue(otherAgentAssoc);

			await expect(
				controller.update(
					mockAgent as AgentType,
					mockAssociation.id,
					updateDto,
				),
			).rejects.toThrow(NotFoundException);
		});
	});
});
