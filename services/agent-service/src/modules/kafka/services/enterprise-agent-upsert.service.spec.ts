import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EnterpriseAgentUpsertService } from './enterprise-agent-upsert.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AgentEntity, OfficeEntity, MLSEntity, AddressEntity, AgentAddressEntity, CompanyEntity } from '@exprealty/database';
import { z } from 'zod';

describe('EnterpriseAgentUpsertService', () => {
	let service: EnterpriseAgentUpsertService;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockLogger: jest.Mocked<LoggerService>;
	let mockAgentRepository: any;
	let mockStatesRepository: any;
	let mockCountriesRepository: any;
	let mockOfficeRepository: any;
	let mockMlsRepository: any;
	let mockAddressRepository: any;
	let mockAgentAddressRepository: any;
	let mockCompanyRepository: any;
	let mockTransactionManager: any;

	beforeEach(async () => {
		mockTransactionManager = {
			findOne: jest.fn(),
			save: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
		};

		mockDataSource = {
			transaction: jest.fn((callback) => callback(mockTransactionManager)),
		} as any;

		mockLogger = {
			setContext: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
		} as any;

		mockAgentRepository = {};
		mockStatesRepository = {
			findByCode: jest.fn(),
		};
		mockCountriesRepository = {};
		mockOfficeRepository = {};
		mockMlsRepository = {};
		mockAddressRepository = {};
		mockAgentAddressRepository = {};
		mockCompanyRepository = {};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EnterpriseAgentUpsertService,
				{
					provide: 'IAgentRepository',
					useValue: mockAgentRepository,
				},
				{
					provide: 'IStatesRepository',
					useValue: mockStatesRepository,
				},
				{
					provide: 'ICountriesRepository',
					useValue: mockCountriesRepository,
				},
				{
					provide: getRepositoryToken(OfficeEntity),
					useValue: mockOfficeRepository,
				},
				{
					provide: getRepositoryToken(MLSEntity),
					useValue: mockMlsRepository,
				},
				{
					provide: getRepositoryToken(AddressEntity),
					useValue: mockAddressRepository,
				},
				{
					provide: getRepositoryToken(AgentAddressEntity),
					useValue: mockAgentAddressRepository,
				},
				{
					provide: getRepositoryToken(CompanyEntity),
					useValue: mockCompanyRepository,
				},
				{
					provide: DataSource,
					useValue: mockDataSource,
				},
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
			],
		}).compile();

		service = module.get<EnterpriseAgentUpsertService>(EnterpriseAgentUpsertService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('normalizeLegacyPayload', () => {
		it('should remove agentCompanyId from legacy payloads', () => {
			const payloadWithAgentCompanyId = {
				agent: {
					id: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'John',
					lastName: 'Doe',
					agentCompanyId: 'legacy-company-id',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
			};

			const normalized = (service as any).normalizeLegacyPayload(payloadWithAgentCompanyId);
			expect(normalized.agent.agentCompanyId).toBeUndefined();
			expect(normalized.agent.firstName).toBe('John');
			expect(normalized.agent.lastName).toBe('Doe');
		});

		it('should remove invalid suffix values from legacy payloads', () => {
			// Test with empty string suffix
			const payloadWithEmptySuffix = {
				agent: {
					id: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'John',
					lastName: 'Doe',
					suffix: '',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
			};
			const normalizedEmpty = (service as any).normalizeLegacyPayload(payloadWithEmptySuffix);
			expect(normalizedEmpty.agent.suffix).toBeUndefined();

			// Test with invalid enum value
			const payloadWithInvalidSuffix = {
				agent: {
					id: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'John',
					lastName: 'Doe',
					suffix: 'InvalidSuffix',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
			};
			const normalizedInvalid = (service as any).normalizeLegacyPayload(payloadWithInvalidSuffix);
			expect(normalizedInvalid.agent.suffix).toBeUndefined();

			// Test with valid suffix (should be kept)
			const payloadWithValidSuffix = {
				agent: {
					id: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'John',
					lastName: 'Doe',
					suffix: 'Jr',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
			};
			const normalizedValid = (service as any).normalizeLegacyPayload(payloadWithValidSuffix);
			expect(normalizedValid.agent.suffix).toBe('Jr');
		});

		it('should handle payloads without agent object', () => {
			const payloadWithoutAgent = {
				contactMethods: [],
				addresses: [],
			};
			const normalized = (service as any).normalizeLegacyPayload(payloadWithoutAgent);
			expect(normalized).toEqual(payloadWithoutAgent);
		});

		it('should handle null and undefined payloads', () => {
			expect((service as any).normalizeLegacyPayload(null)).toBeNull();
			expect((service as any).normalizeLegacyPayload(undefined)).toBeUndefined();
		});
	});

	describe('upsertAgentWithAssociations', () => {
		it('should throw error when agent.id is missing', async () => {
			// Arrange
			const payloadWithoutId = {
				agent: {
					firstName: 'John',
					lastName: 'Doe',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
				contactMethods: [],
				addresses: [],
				offices: [],
				mls: [],
			};

			// Act & Assert
			await expect(service.upsertAgentWithAssociations(payloadWithoutId)).rejects.toThrow(z.ZodError);
		});

		it('should throw error when agent.id is empty string', async () => {
			// Arrange
			const payloadWithEmptyId = {
				agent: {
					id: '',
					firstName: 'John',
					lastName: 'Doe',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
				contactMethods: [],
				addresses: [],
				offices: [],
				mls: [],
			};

			// Act & Assert
			await expect(service.upsertAgentWithAssociations(payloadWithEmptyId)).rejects.toThrow(z.ZodError);
		});

		it('should throw error when agent.id is not a valid UUID', async () => {
			// Arrange
			const payloadWithInvalidId = {
				agent: {
					id: 'not-a-uuid',
					firstName: 'John',
					lastName: 'Doe',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
				contactMethods: [],
				addresses: [],
				offices: [],
				mls: [],
			};

			// Act & Assert
			await expect(service.upsertAgentWithAssociations(payloadWithInvalidId)).rejects.toThrow(z.ZodError);
		});

		it('should successfully upsert agent when agent.id is provided', async () => {
			// Arrange
			const validPayload = {
				agent: {
					id: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'John',
					lastName: 'Doe',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
				contactMethods: [],
				addresses: [],
				offices: [],
				mls: [],
			};

			const mockAgent = {
				id: '550e8400-e29b-41d4-a716-446655440000',
				firstName: 'John',
				lastName: 'Doe',
			} as AgentEntity;

			mockTransactionManager.findOne.mockResolvedValue(null); // Agent doesn't exist
			mockTransactionManager.create.mockReturnValue(mockAgent);
			mockTransactionManager.save.mockResolvedValue(mockAgent);

			// Act
			await service.upsertAgentWithAssociations(validPayload);

			// Assert
			expect(mockTransactionManager.findOne).toHaveBeenCalledWith(AgentEntity, {
				where: { id: '550e8400-e29b-41d4-a716-446655440000' },
			});
			expect(mockTransactionManager.create).toHaveBeenCalled();
			expect(mockTransactionManager.save).toHaveBeenCalled();
		});

		it('should update existing agent when agent.id exists', async () => {
			// Arrange
			const validPayload = {
				agent: {
					id: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'Jane',
					lastName: 'Smith',
					isStaff: false,
					lifecycleStatus: 'Active',
				},
				contactMethods: [],
				addresses: [],
				offices: [],
				mls: [],
			};

			const existingAgent = {
				id: '550e8400-e29b-41d4-a716-446655440000',
				firstName: 'John',
				lastName: 'Doe',
			} as AgentEntity;

			mockTransactionManager.findOne.mockResolvedValue(existingAgent);
			mockTransactionManager.save.mockResolvedValue({
				...existingAgent,
				firstName: 'Jane',
				lastName: 'Smith',
			});

			// Act
			await service.upsertAgentWithAssociations(validPayload);

			// Assert
			expect(mockTransactionManager.findOne).toHaveBeenCalledWith(AgentEntity, {
				where: { id: '550e8400-e29b-41d4-a716-446655440000' },
			});
			expect(mockTransactionManager.save).toHaveBeenCalled();
			expect(existingAgent.firstName).toBe('Jane');
			expect(existingAgent.lastName).toBe('Smith');
		});
	});
});

