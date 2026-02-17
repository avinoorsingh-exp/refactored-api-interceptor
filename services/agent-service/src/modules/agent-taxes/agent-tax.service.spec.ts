import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AgentTaxService } from './agent-tax.service.js';
import type { IAgentTaxRepository } from './ports/agent-tax.repository.port.js';
import type { TaxIdHasher } from '../../common/ports/tax-id-hasher.port.js';
import type { AgentTax, CreateAgentTaxInput, UpdateAgentTaxInput } from '@exprealty/shared-domain';
import { LoggerService } from '../../core/logger.service.js';

describe('AgentTaxService', () => {
	let service: AgentTaxService;
	let repository: jest.Mocked<IAgentTaxRepository>;
	let hasher: jest.Mocked<TaxIdHasher>;
	let logger: jest.Mocked<LoggerService>;

	const AGENT_ID = '11111111-1111-1111-1111-111111111111';
	const TAX_ID = '22222222-2222-2222-2222-222222222222';
	const AGENT_TAX_ID = '33333333-3333-3333-3333-333333333333';
	const MOCK_HASH = 'a'.repeat(64);

	const mockAgentTax: AgentTax = {
		id: AGENT_TAX_ID,
		agentId: AGENT_ID,
		taxId: TAX_ID,
		isPrimary: false,
		tax: {
			id: TAX_ID,
			taxIdType: 'SSN',
			value: '*****6789',
			valueToken: MOCK_HASH,
			created: new Date('2024-01-15T10:00:00Z'),
			lastModified: new Date('2024-01-15T10:00:00Z'),
			modifiedBy: 'system',
		},
	};

	beforeEach(() => {
		repository = {
			findById: jest.fn(),
			findByAgentId: jest.fn(),
			findByAgentAndTax: jest.fn(),
			findPrimaryByAgentId: jest.fn(),
			createWithTax: jest.fn(),
			updateTaxValue: jest.fn(),
			findAll: jest.fn(),
			findPage: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		} as jest.Mocked<IAgentTaxRepository>;

		hasher = {
			hash: jest.fn().mockReturnValue(MOCK_HASH),
		};

		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as unknown as jest.Mocked<LoggerService>;

		service = new AgentTaxService(repository, hasher, logger);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// =========================================================================
	// create()
	// =========================================================================

	describe('create', () => {
		const createDto: CreateAgentTaxInput = {
			taxIdType: 'SSN',
			value: '123-45-6789',
			isPrimary: false,
		};

		it('should call createWithTax with valueLast4 and valueToken, not raw value', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [], total: 0 });
			repository.createWithTax.mockResolvedValue(mockAgentTax);

			await service.create(AGENT_ID, createDto);

			expect(repository.createWithTax).toHaveBeenCalledWith(
				AGENT_ID,
				{
					taxIdType: 'SSN',
					valueLast4: '6789',
					valueToken: MOCK_HASH,
				},
				false,
			);
		});

		it('should return a response with masked value, never plaintext', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [], total: 0 });
			repository.createWithTax.mockResolvedValue(mockAgentTax);

			const result = await service.create(AGENT_ID, createDto);

			expect(result.tax?.value).toBe('*****6789');
			expect(result.tax?.value).not.toContain('123-45-6789');
		});

		it('should call hasher.hash with the raw value', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [], total: 0 });
			repository.createWithTax.mockResolvedValue(mockAgentTax);

			await service.create(AGENT_ID, createDto);

			expect(hasher.hash).toHaveBeenCalledWith('123-45-6789');
		});

		it('should throw BadRequestException when value is a masked placeholder', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [], total: 0 });

			const maskedDto: CreateAgentTaxInput = {
				taxIdType: 'SSN',
				value: '*****6789',
				isPrimary: false,
			};

			await expect(service.create(AGENT_ID, maskedDto)).rejects.toThrow(BadRequestException);

			expect(repository.createWithTax).not.toHaveBeenCalled();
			expect(hasher.hash).not.toHaveBeenCalled();
		});

		it('should throw ConflictException when agent already has this tax type', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [mockAgentTax], total: 1 });

			await expect(service.create(AGENT_ID, createDto)).rejects.toThrow(ConflictException);

			expect(repository.createWithTax).not.toHaveBeenCalled();
		});

		it('should propagate unexpected errors and log them', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [], total: 0 });
			const error = new Error('Database connection failed');
			repository.createWithTax.mockRejectedValue(error);

			await expect(service.create(AGENT_ID, createDto)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// update()
	// =========================================================================

	describe('update', () => {
		it('should call updateTaxValue with pre-computed last4 and token', async () => {
			repository.findById.mockResolvedValue(mockAgentTax);
			repository.updateTaxValue.mockResolvedValue(mockAgentTax.tax!);

			const updateDto: UpdateAgentTaxInput = { value: '987-65-4321' };
			// After update, re-fetch returns updated
			const updatedAgentTax: AgentTax = {
				...mockAgentTax,
				tax: {
					...mockAgentTax.tax!,
					value: '*****4321',
				},
			};
			repository.findById.mockResolvedValueOnce(mockAgentTax).mockResolvedValueOnce(updatedAgentTax);

			await service.update(AGENT_ID, AGENT_TAX_ID, updateDto);

			expect(repository.updateTaxValue).toHaveBeenCalledWith(
				TAX_ID,
				'4321',
				MOCK_HASH,
			);
		});

		it('should throw BadRequestException when update value is a masked placeholder', async () => {
			repository.findById.mockResolvedValue(mockAgentTax);

			const updateDto: UpdateAgentTaxInput = { value: '*****6789' };

			await expect(service.update(AGENT_ID, AGENT_TAX_ID, updateDto)).rejects.toThrow(BadRequestException);

			expect(repository.updateTaxValue).not.toHaveBeenCalled();
			expect(hasher.hash).not.toHaveBeenCalled();
		});

		it('should throw NotFoundException when agent tax does not exist', async () => {
			repository.findById.mockResolvedValue(null);

			const updateDto: UpdateAgentTaxInput = { value: '987-65-4321' };

			await expect(service.update(AGENT_ID, AGENT_TAX_ID, updateDto)).rejects.toThrow(NotFoundException);
		});

		it('should throw NotFoundException when tax belongs to different agent', async () => {
			const OTHER_AGENT_ID = '99999999-9999-9999-9999-999999999999';
			repository.findById.mockResolvedValue(mockAgentTax);

			const updateDto: UpdateAgentTaxInput = { value: '987-65-4321' };

			await expect(service.update(OTHER_AGENT_ID, AGENT_TAX_ID, updateDto)).rejects.toThrow(NotFoundException);

			expect(repository.updateTaxValue).not.toHaveBeenCalled();
		});

		it('should update isPrimary without touching tax value', async () => {
			repository.findById.mockResolvedValue(mockAgentTax);
			repository.update.mockResolvedValue(mockAgentTax);

			const updateDto: UpdateAgentTaxInput = { isPrimary: true };

			await service.update(AGENT_ID, AGENT_TAX_ID, updateDto);

			expect(repository.update).toHaveBeenCalledWith(AGENT_TAX_ID, { isPrimary: true });
			expect(repository.updateTaxValue).not.toHaveBeenCalled();
		});

		it('should propagate unexpected errors from updateTaxValue and log them', async () => {
			repository.findById.mockResolvedValue(mockAgentTax);
			const error = new Error('Database error');
			repository.updateTaxValue.mockRejectedValue(error);

			const updateDto: UpdateAgentTaxInput = { value: '987-65-4321' };

			await expect(service.update(AGENT_ID, AGENT_TAX_ID, updateDto)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// findById()
	// =========================================================================

	describe('findById', () => {
		it('should return the agent tax when found and owned by agent', async () => {
			repository.findById.mockResolvedValue(mockAgentTax);

			const result = await service.findById(AGENT_ID, AGENT_TAX_ID);

			expect(result).toEqual(mockAgentTax);
		});

		it('should throw NotFoundException when not found', async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.findById(AGENT_ID, AGENT_TAX_ID)).rejects.toThrow(NotFoundException);
		});

		it('should throw NotFoundException when tax belongs to different agent', async () => {
			const OTHER_AGENT_ID = '99999999-9999-9999-9999-999999999999';
			repository.findById.mockResolvedValue(mockAgentTax);

			await expect(service.findById(OTHER_AGENT_ID, AGENT_TAX_ID)).rejects.toThrow(NotFoundException);
		});

		it('should propagate unexpected errors and log them', async () => {
			const error = new Error('Database error');
			repository.findById.mockRejectedValue(error);

			await expect(service.findById(AGENT_ID, AGENT_TAX_ID)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// findByAgentId()
	// =========================================================================

	describe('findByAgentId', () => {
		it('should return paginated taxes for the agent', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [mockAgentTax], total: 1 });

			const result = await service.findByAgentId(AGENT_ID, { offset: 0, limit: 25 });

			expect(result).toEqual({ items: [mockAgentTax], total: 1 });
			expect(repository.findByAgentId).toHaveBeenCalledWith(AGENT_ID, { offset: 0, limit: 25 });
		});

		it('should return empty results when agent has no taxes', async () => {
			repository.findByAgentId.mockResolvedValue({ items: [], total: 0 });

			const result = await service.findByAgentId(AGENT_ID);

			expect(result).toEqual({ items: [], total: 0 });
		});

		it('should propagate unexpected errors and log them', async () => {
			const error = new Error('Database error');
			repository.findByAgentId.mockRejectedValue(error);

			await expect(service.findByAgentId(AGENT_ID)).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
