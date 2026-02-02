import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LicenseService } from './license.service.js';
import type { ILicenseRepository } from './ports/license.repository.port.js';
import type { License, CreateLicenseInput, UpdateLicenseInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Unit tests for LicenseService
 * Tests create(), findById(), update(), findByAgentId() with mocked repository
 */
describe('LicenseService', () => {
	let service: LicenseService;
	let repository: jest.Mocked<ILicenseRepository>;
	let logger: jest.Mocked<LoggerService>;

	const mockAgentId = '550e8400-e29b-41d4-a716-446655440000';

	/** Mock US country (requires state) */
	const mockUSCountry = { id: 1, alpha2: 'US', name: 'United States' };
	/** Mock Canada country (does not require state) */
	const mockCanadaCountry = { id: 2, alpha2: 'CA', name: 'Canada' };
	/** Mock state */
	const mockState = { code: 'CA', countryId: 1, name: 'California' };
	/** Mock line of business */
	const mockLineOfBusiness = { id: '1', name: 'Real Estate' };

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

	beforeEach(() => {
		repository = {
			findById: jest.fn(),
			findByAgentAndNumber: jest.fn(),
			findByAgentId: jest.fn(),
			findPrimaryByAgentId: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			findCountryById: jest.fn(),
			findStateByCodeAndCountry: jest.fn(),
			findLineOfBusinessById: jest.fn(),
		} as jest.Mocked<ILicenseRepository>;

		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as unknown as jest.Mocked<LoggerService>;

		service = new LicenseService(repository, logger);

		// Default happy path mocks
		repository.findCountryById.mockResolvedValue(mockUSCountry);
		repository.findStateByCodeAndCountry.mockResolvedValue(mockState);
		repository.findLineOfBusinessById.mockResolvedValue(mockLineOfBusiness);
		repository.findPrimaryByAgentId.mockResolvedValue(null);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('create', () => {
		const createDto: CreateLicenseInput = {
			number: 'RE-67890',
			type: 'Broker',
			isPrimary: false,
			firstName: 'Jane',
			lastName: 'Smith',
			lineOfBusinessId: '1',
			countryId: 1,
			stateCode: 'TX',
		};

		/** Mock TX state for create tests */
		const mockTXState = { code: 'TX', countryId: 1, name: 'Texas' };

		beforeEach(() => {
			// Override state mock for TX
			repository.findStateByCodeAndCountry.mockImplementation(async (code) => {
				if (code === 'TX') return mockTXState;
				if (code === 'CA') return mockState;
				return null;
			});
		});

		/**
		 * Test successful license creation
		 */
		it('should create a new license when number does not exist for agent', async () => {
			const newLicense: License = {
				...mockLicense,
				id: '770e8400-e29b-41d4-a716-446655440002',
				number: 'RE-67890',
				firstName: 'Jane',
				lastName: 'Smith',
				stateCode: 'TX',
				isPrimary: false,
			};

			repository.findByAgentAndNumber.mockResolvedValue(null);
			repository.create.mockResolvedValue(newLicense);

			const result = await service.create(mockAgentId, createDto);

			expect(result).toEqual(newLicense);
			expect(repository.findByAgentAndNumber).toHaveBeenCalledWith(mockAgentId, 'RE-67890');
			expect(repository.create).toHaveBeenCalledWith({
				...createDto,
				agentId: mockAgentId,
			});
		});

		/**
		 * Test duplicate license number detection (scoped to agent)
		 */
		it('should throw ConflictException when license number already exists for agent', async () => {
			repository.findByAgentAndNumber.mockResolvedValue(mockLicense);

			await expect(service.create(mockAgentId, createDto)).rejects.toThrow(ConflictException);
			await expect(service.create(mockAgentId, createDto)).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('RE-67890'),
					i18nType: 'license.number_conflict',
				},
			});

			expect(repository.findByAgentAndNumber).toHaveBeenCalledWith(mockAgentId, 'RE-67890');
			expect(repository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test primary license conflict
		 */
		it('should throw ConflictException when agent already has a primary license', async () => {
			const primaryDto: CreateLicenseInput = { ...createDto, isPrimary: true };
			repository.findPrimaryByAgentId.mockResolvedValue(mockLicense);

			await expect(service.create(mockAgentId, primaryDto)).rejects.toThrow(ConflictException);
			await expect(service.create(mockAgentId, primaryDto)).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('primary license'),
					i18nType: 'license.primary_conflict',
				},
			});

			expect(repository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test country not found validation
		 */
		it('should throw BadRequestException when country does not exist', async () => {
			repository.findCountryById.mockResolvedValue(null);

			await expect(service.create(mockAgentId, createDto)).rejects.toThrow(BadRequestException);
			await expect(service.create(mockAgentId, createDto)).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('Country'),
					i18nType: 'license.country_not_found',
				},
			});

			expect(repository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test line of business not found validation
		 */
		it('should throw BadRequestException when line of business does not exist', async () => {
			repository.findLineOfBusinessById.mockResolvedValue(null);

			await expect(service.create(mockAgentId, createDto)).rejects.toThrow(BadRequestException);
			await expect(service.create(mockAgentId, createDto)).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('Line of business'),
					i18nType: 'license.line_of_business_not_found',
				},
			});

			expect(repository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test state required for US licenses
		 */
		it('should throw BadRequestException when state is missing for US license', async () => {
			const usLicenseWithoutState: CreateLicenseInput = {
				...createDto,
				stateCode: undefined,
			};

			await expect(service.create(mockAgentId, usLicenseWithoutState)).rejects.toThrow(BadRequestException);
			await expect(service.create(mockAgentId, usLicenseWithoutState)).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('State is required'),
					i18nType: 'license.state_required_for_us',
				},
			});

			expect(repository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test state not required for non-US licenses
		 */
		it('should allow non-US license without state', async () => {
			const canadaLicenseWithoutState: CreateLicenseInput = {
				...createDto,
				countryId: 2,
				stateCode: undefined,
			};

			repository.findCountryById.mockResolvedValue(mockCanadaCountry);
			repository.findByAgentAndNumber.mockResolvedValue(null);
			repository.create.mockResolvedValue({
				...mockLicense,
				countryId: 2,
				stateCode: undefined,
			});

			const result = await service.create(mockAgentId, canadaLicenseWithoutState);

			expect(result.countryId).toBe(2);
			expect(result.stateCode).toBeUndefined();
			expect(repository.findStateByCodeAndCountry).not.toHaveBeenCalled();
		});

		/**
		 * Test state not found validation
		 */
		it('should throw BadRequestException when state does not exist for country', async () => {
			const invalidStateDto: CreateLicenseInput = {
				...createDto,
				stateCode: 'ZZ',
			};

			repository.findStateByCodeAndCountry.mockResolvedValue(null);

			await expect(service.create(mockAgentId, invalidStateDto)).rejects.toThrow(BadRequestException);
			await expect(service.create(mockAgentId, invalidStateDto)).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('ZZ'),
					i18nType: 'license.state_not_found',
				},
			});

			expect(repository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test error propagation from repository
		 */
		it('should propagate unexpected errors from repository', async () => {
			const error = new Error('Database connection failed');
			repository.findByAgentAndNumber.mockResolvedValue(null);
			repository.create.mockRejectedValue(error);

			await expect(service.create(mockAgentId, createDto)).rejects.toThrow(error);
		});
	});

	describe('findById', () => {
		/**
		 * Test successful retrieval by ID
		 */
		it('should return license when found by ID and belongs to agent', async () => {
			repository.findById.mockResolvedValue(mockLicense);

			const result = await service.findById(mockAgentId, mockLicense.id);

			expect(result).toEqual(mockLicense);
			expect(repository.findById).toHaveBeenCalledWith(mockLicense.id);
		});

		/**
		 * Test not found scenario
		 */
		it('should throw NotFoundException when license not found by ID', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.findById(mockAgentId, 'non-existent-id')).rejects.toThrow(NotFoundException);
			await expect(service.findById(mockAgentId, 'non-existent-id')).rejects.toMatchObject({
				response: {
					message: expect.stringContaining('non-existent-id'),
					i18nType: 'license.not_found',
				},
			});

			expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
		});

		/**
		 * Test license belonging to different agent
		 */
		it('should throw NotFoundException when license belongs to different agent', async () => {
			const differentAgentLicense = { ...mockLicense, agentId: 'different-agent-id' };
			repository.findById.mockResolvedValue(differentAgentLicense);

			await expect(service.findById(mockAgentId, mockLicense.id)).rejects.toThrow(NotFoundException);
			await expect(service.findById(mockAgentId, mockLicense.id)).rejects.toMatchObject({
				response: {
					i18nType: 'license.not_found',
				},
			});
		});

		/**
		 * Test error propagation
		 */
		it('should propagate unexpected errors from repository', async () => {
			const error = new Error('Database error');
			repository.findById.mockRejectedValue(error);

			await expect(service.findById(mockAgentId, mockLicense.id)).rejects.toThrow(error);
		});
	});

	describe('update', () => {
		const updateDto: UpdateLicenseInput = { number: 'RE-UPDATED', firstName: 'Updated' };

		/**
		 * Test successful update
		 */
		it('should update license when it exists and belongs to agent', async () => {
			const updatedLicense: License = {
				...mockLicense,
				number: 'RE-UPDATED',
				firstName: 'Updated',
			};

			repository.findById.mockResolvedValue(mockLicense);
			repository.findByAgentAndNumber.mockResolvedValue(null);
			repository.update.mockResolvedValue(updatedLicense);

			const result = await service.update(mockAgentId, mockLicense.id, updateDto);

			expect(result).toEqual(updatedLicense);
			expect(repository.findById).toHaveBeenCalledWith(mockLicense.id);
			expect(repository.update).toHaveBeenCalledWith(mockLicense.id, updateDto);
		});

		/**
		 * Test not found on update
		 */
		it('should throw NotFoundException when updating non-existent license', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.update(mockAgentId, 'non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
			await expect(service.update(mockAgentId, 'non-existent-id', updateDto)).rejects.toMatchObject({
				response: {
					i18nType: 'license.not_found',
				},
			});

			expect(repository.update).not.toHaveBeenCalled();
		});

		/**
		 * Test duplicate number detection on update
		 */
		it('should throw ConflictException when updating to existing number', async () => {
			const updateWithNumber: UpdateLicenseInput = { number: 'EXISTING-NUMBER' };
			const existingLicense: License = {
				...mockLicense,
				id: 'different-id',
				number: 'EXISTING-NUMBER',
			};

			repository.findById.mockResolvedValue(mockLicense);
			repository.findByAgentAndNumber.mockResolvedValue(existingLicense);

			await expect(service.update(mockAgentId, mockLicense.id, updateWithNumber)).rejects.toThrow(ConflictException);
			await expect(service.update(mockAgentId, mockLicense.id, updateWithNumber)).rejects.toMatchObject({
				response: {
					i18nType: 'license.number_conflict',
				},
			});

			expect(repository.update).not.toHaveBeenCalled();
		});

		/**
		 * Test updating to same number (should be allowed)
		 */
		it('should allow updating to the same number', async () => {
			const updateWithSameNumber: UpdateLicenseInput = { number: mockLicense.number };
			const updatedLicense: License = { ...mockLicense };

			repository.findById.mockResolvedValue(mockLicense);
			repository.findByAgentAndNumber.mockResolvedValue(mockLicense); // Same license
			repository.update.mockResolvedValue(updatedLicense);

			const result = await service.update(mockAgentId, mockLicense.id, updateWithSameNumber);

			expect(result).toEqual(updatedLicense);
			expect(repository.update).toHaveBeenCalled();
		});

		/**
		 * Test update without number change (should skip duplicate check)
		 */
		it('should skip duplicate check when number is not being changed', async () => {
			const updateWithoutNumber: UpdateLicenseInput = { firstName: 'NewName' };
			const updatedLicense: License = { ...mockLicense, firstName: 'NewName' };

			repository.findById.mockResolvedValue(mockLicense);
			repository.update.mockResolvedValue(updatedLicense);

			const result = await service.update(mockAgentId, mockLicense.id, updateWithoutNumber);

			expect(result).toEqual(updatedLicense);
			expect(repository.findByAgentAndNumber).not.toHaveBeenCalled();
			expect(repository.update).toHaveBeenCalledWith(mockLicense.id, updateWithoutNumber);
		});

		/**
		 * Test primary license conflict on update
		 */
		it('should throw ConflictException when setting isPrimary to true and agent already has primary', async () => {
			const nonPrimaryLicense: License = { ...mockLicense, isPrimary: false };
			const existingPrimary: License = { ...mockLicense, id: 'other-primary-id' };

			repository.findById.mockResolvedValue(nonPrimaryLicense);
			repository.findPrimaryByAgentId.mockResolvedValue(existingPrimary);

			await expect(
				service.update(mockAgentId, nonPrimaryLicense.id, { isPrimary: true }),
			).rejects.toThrow(ConflictException);

			await expect(
				service.update(mockAgentId, nonPrimaryLicense.id, { isPrimary: true }),
			).rejects.toMatchObject({
				response: {
					i18nType: 'license.primary_conflict',
				},
			});

			expect(repository.update).not.toHaveBeenCalled();
		});

		/**
		 * Test updating non-primary to primary when no existing primary (should succeed)
		 */
		it('should allow setting isPrimary to true when no existing primary license', async () => {
			const nonPrimaryLicense: License = { ...mockLicense, isPrimary: false };
			const updatedLicense: License = { ...nonPrimaryLicense, isPrimary: true };

			repository.findById.mockResolvedValue(nonPrimaryLicense);
			repository.findPrimaryByAgentId.mockResolvedValue(null);
			repository.update.mockResolvedValue(updatedLicense);

			const result = await service.update(mockAgentId, nonPrimaryLicense.id, { isPrimary: true });

			expect(result.isPrimary).toBe(true);
			expect(repository.update).toHaveBeenCalled();
		});

		/**
		 * Test validation when countryId is changed to invalid
		 */
		it('should throw BadRequestException when updating countryId to non-existent country', async () => {
			repository.findById.mockResolvedValue(mockLicense);
			repository.findCountryById.mockResolvedValue(null);

			await expect(
				service.update(mockAgentId, mockLicense.id, { countryId: 999 }),
			).rejects.toThrow(BadRequestException);

			await expect(
				service.update(mockAgentId, mockLicense.id, { countryId: 999 }),
			).rejects.toMatchObject({
				response: {
					i18nType: 'license.country_not_found',
				},
			});

			expect(repository.update).not.toHaveBeenCalled();
		});

		/**
		 * Test state required when changing to US country
		 */
		it('should throw BadRequestException when changing to US country without state', async () => {
			const canadaLicense: License = { ...mockLicense, countryId: 2, stateCode: undefined };
			repository.findById.mockResolvedValue(canadaLicense);
			repository.findCountryById.mockResolvedValue(mockUSCountry);

			await expect(
				service.update(mockAgentId, canadaLicense.id, { countryId: 1 }),
			).rejects.toThrow(BadRequestException);

			await expect(
				service.update(mockAgentId, canadaLicense.id, { countryId: 1 }),
			).rejects.toMatchObject({
				response: {
					i18nType: 'license.state_required_for_us',
				},
			});

			expect(repository.update).not.toHaveBeenCalled();
		});

		/**
		 * Test error propagation
		 */
		it('should propagate unexpected errors from repository', async () => {
			const error = new Error('Database error');
			repository.findById.mockResolvedValue(mockLicense);
			repository.findByAgentAndNumber.mockResolvedValue(null);
			repository.update.mockRejectedValue(error);

			await expect(service.update(mockAgentId, mockLicense.id, updateDto)).rejects.toThrow(error);
		});
	});

	describe('findByAgentId', () => {
		/**
		 * Test paginated retrieval
		 */
		it('should return paginated licenses from repository', async () => {
			const mockLicenses = [
				{ ...mockLicense, number: 'RE-001' },
				{ ...mockLicense, id: 'another-id', number: 'RE-002' },
			];

			repository.findByAgentId.mockResolvedValue({
				items: mockLicenses,
				total: 50,
			});

			const result = await service.findByAgentId(mockAgentId, { offset: 0, limit: 25 });

			expect(result.items).toEqual(mockLicenses);
			expect(result.total).toBe(50);
			expect(repository.findByAgentId).toHaveBeenCalledWith(mockAgentId, { offset: 0, limit: 25 }, undefined);
		});

		/**
		 * Test pagination with offset
		 */
		it('should handle pagination offset correctly', async () => {
			repository.findByAgentId.mockResolvedValue({
				items: [mockLicense],
				total: 50,
			});

			const result = await service.findByAgentId(mockAgentId, { offset: 25, limit: 25 });

			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(50);
			expect(repository.findByAgentId).toHaveBeenCalledWith(mockAgentId, { offset: 25, limit: 25 }, undefined);
		});

		/**
		 * Test empty result set
		 */
		it('should handle empty result set', async () => {
			repository.findByAgentId.mockResolvedValue({
				items: [],
				total: 0,
			});

			const result = await service.findByAgentId(mockAgentId, { offset: 0, limit: 25 });

			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
		});

		/**
		 * Test error propagation
		 */
		it('should propagate errors from repository', async () => {
			const error = new Error('Database error');
			repository.findByAgentId.mockRejectedValue(error);

			await expect(service.findByAgentId(mockAgentId, { offset: 0, limit: 25 })).rejects.toThrow(error);
		});
	});
});
