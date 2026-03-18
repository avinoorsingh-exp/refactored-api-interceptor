import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LicenseController } from './license.controller.js';
import { LicenseService } from './license.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { PaginationModule } from '../../../common/pagination/pagination.module.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import type { License, Agent as AgentType } from '@exprealty/shared-domain';
import type { Response } from 'express';

/**
 * Unit tests for LicenseController
 * Tests create(), findAll(), findById(), update() with mocked service
 */
describe('LicenseController', () => {
	let controller: LicenseController;
	let service: jest.Mocked<LicenseService>;
	let logger: jest.Mocked<LoggerService>;

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

	const mockLicense: License = {
		id: '660e8400-e29b-41d4-a716-446655440001',
		agentId: mockAgentId,
		number: 'RE-12345',
		type: 'Broker',
		isPrimary: true,
		firstName: 'John',
		middleName: 'Michael',
		lastName: 'Doe',
		suffix: 'Jr',
		expirationDate: '2025-12-31',
		lineOfBusinessId: '1',
		countryId: 1,
		stateCode: 'CA',
		created: new Date('2024-01-15T10:30:00Z'),
		lastModified: new Date('2024-01-15T14:45:00Z'),
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
			findById: jest.fn(),
			findByAgentId: jest.fn(),
			update: jest.fn(),
		};

		const mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [LicenseController],
			providers: [
				{
					provide: LicenseService,
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

		controller = module.get<LicenseController>(LicenseController);
		service = module.get(LicenseService);
		logger = module.get(LoggerService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('POST /v1/agents/:id/licenses (create)', () => {
		const createDto = {
			number: 'RE-67890',
			type: 'Broker' as const,
			isPrimary: true,
			firstName: 'Jane',
			lastName: 'Smith',
			lineOfBusinessId: '1',
			countryId: 1,
			stateCode: 'TX',
		};

		/**
		 * Test successful license creation
		 */
		it('should create a new license successfully and set Location header', async () => {
			const newLicense: License = {
				...mockLicense,
				id: '770e8400-e29b-41d4-a716-446655440002',
				number: 'RE-67890',
				firstName: 'Jane',
				lastName: 'Smith',
				stateCode: 'TX',
			};
			service.create.mockResolvedValue(newLicense);

			const res = mockResponse();
			const result = await controller.create(mockAgent, createDto, res);

			expect(result).toEqual(newLicense);
			expect(service.create).toHaveBeenCalledWith(mockAgentId, createDto);
			expect(res.setHeader).toHaveBeenCalledWith(
				'Location',
				`/v1/agents/${mockAgentId}/licenses/${newLicense.id}`,
			);
		});

		/**
		 * Test duplicate license number handling
		 */
		it('should throw ConflictException for duplicate license number', async () => {
			service.create.mockRejectedValue(
				new ConflictException({
					message: "License with number 'RE-67890' already exists for this agent",
					i18nType: 'license.number_conflict',
				}),
			);

			const res = mockResponse();

			await expect(controller.create(mockAgent, createDto, res)).rejects.toThrow(
				ConflictException,
			);
			expect(service.create).toHaveBeenCalledWith(mockAgentId, createDto);
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

	describe('GET /v1/agents/:id/licenses (findAll)', () => {
		/**
		 * Test paginated list retrieval
		 */
		it('should return paginated licenses with total count', async () => {
			const mockLicenses = [
				{ ...mockLicense, number: 'RE-001' },
				{ ...mockLicense, id: 'another-id', number: 'RE-002' },
				{ ...mockLicense, id: 'third-id', number: 'RE-003' },
			];

			service.findByAgentId.mockResolvedValue({
				items: mockLicenses,
				total: 50,
			});

			const result = await controller.findAll(mockAgent, { offset: 0, limit: 25 });

			expect(result).toEqual({
				items: mockLicenses,
				total: 50,
			});
			expect(service.findByAgentId).toHaveBeenCalled();
		});

		/**
		 * Test pagination with offset
		 */
		it('should handle pagination offset correctly', async () => {
			const mockLicenses = [{ ...mockLicense, number: 'RE-003' }];

			service.findByAgentId.mockResolvedValue({
				items: mockLicenses,
				total: 50,
			});

			const result = await controller.findAll(mockAgent, { offset: 25, limit: 25 });

			expect(result.items).toEqual(mockLicenses);
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
	});

	describe('GET /v1/agents/:id/licenses/:licenseId (findById)', () => {
		/**
		 * Test successful retrieval by ID
		 */
		it('should return a license when found by ID', async () => {
			service.findById.mockResolvedValue(mockLicense);

			const result = await controller.findById(mockAgent, mockLicense.id);

			expect(result).toEqual(mockLicense);
			expect(service.findById).toHaveBeenCalledWith(mockAgentId, mockLicense.id);
		});

		/**
		 * Test 404 not found scenario
		 */
		it('should throw NotFoundException when license not found', async () => {
			service.findById.mockRejectedValue(
				new NotFoundException({
					message: "License with id 'non-existent-id' not found",
					i18nType: 'license.not_found',
				}),
			);

			await expect(
				controller.findById(mockAgent, 'non-existent-id'),
			).rejects.toThrow(NotFoundException);

			expect(service.findById).toHaveBeenCalledWith(mockAgentId, 'non-existent-id');
		});
	});

	describe('PUT /v1/agents/:id/licenses/:licenseId (update)', () => {
		const updateDto = { number: 'RE-UPDATED', firstName: 'Updated' };

		/**
		 * Test successful license update
		 */
		it('should update a license successfully', async () => {
			const updatedLicense: License = {
				...mockLicense,
				number: 'RE-UPDATED',
				firstName: 'Updated',
			};
			service.update.mockResolvedValue(updatedLicense);

			const result = await controller.update(mockAgent, mockLicense.id, updateDto);

			expect(result).toEqual(updatedLicense);
			expect(service.update).toHaveBeenCalledWith(mockAgentId, mockLicense.id, updateDto);
		});

		/**
		 * Test 404 not found on update
		 */
		it('should throw NotFoundException when updating non-existent license', async () => {
			service.update.mockRejectedValue(
				new NotFoundException({
					message: "License with id 'non-existent-id' not found",
					i18nType: 'license.not_found',
				}),
			);

			await expect(
				controller.update(mockAgent, 'non-existent-id', updateDto),
			).rejects.toThrow(NotFoundException);

			expect(service.update).toHaveBeenCalledWith(mockAgentId, 'non-existent-id', updateDto);
		});

		/**
		 * Test duplicate number conflict on update
		 */
		it('should throw ConflictException when updating to duplicate number', async () => {
			const updateWithNumber = { number: 'EXISTING-NUMBER' };
			service.update.mockRejectedValue(
				new ConflictException({
					message: "License with number 'EXISTING-NUMBER' already exists for this agent",
					i18nType: 'license.number_conflict',
				}),
			);

			await expect(
				controller.update(mockAgent, mockLicense.id, updateWithNumber),
			).rejects.toThrow(ConflictException);
		});

		/**
		 * Test error propagation
		 */
		it('should propagate unexpected errors from service', async () => {
			const error = new Error('Database error');
			service.update.mockRejectedValue(error);

			await expect(
				controller.update(mockAgent, mockLicense.id, updateDto),
			).rejects.toThrow(error);
		});
	});
});
