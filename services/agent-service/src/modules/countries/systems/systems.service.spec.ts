import { NotFoundException, BadRequestException } from '@nestjs/common'
import { SystemsService } from './systems.service.js'
import type { ISystemsRepository } from './ports/systems.repository.port.js'
import type { ICurrenciesRepository } from '../../currencies/ports/currencies.repository.port.js'
import type { System, CreateSystemInput, Currency } from '@exprealty/shared-domain'
import { LoggerService } from '../../../core/logger.service.js'

/**
 * Unit tests for SystemsService
 * Tests create, update, findByIdInCountry, findPageByCountry, getCurrency
 */
describe('SystemsService', () => {
	let service: SystemsService
	let systemsRepository: jest.Mocked<ISystemsRepository>
	let currenciesRepository: jest.Mocked<ICurrenciesRepository>
	let logger: jest.Mocked<LoggerService>

	const mockCurrency: Currency = {
		id: 1,
		code: 'USD',
		number: 840,
		name: 'US Dollar',
		symbol: '$',
		minorUnits: 2,
		created: new Date('2024-01-15T10:30:00Z'),
		lastModified: new Date('2024-01-15T14:45:00Z'),
		modifiedBy: 'system',
	}

	const mockSystem: System = {
		id: '1',
		countryId: 1,
		currencyId: 1,
		description: 'US Dollar System',
		created: new Date('2024-01-15T10:30:00Z'),
		lastModified: new Date('2024-01-15T14:45:00Z'),
		modifiedBy: 'system',
	}

	beforeEach(() => {
		systemsRepository = {
			findById: jest.fn(),
			findByIdInCountry: jest.fn(),
			findPageByCountry: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		} as jest.Mocked<ISystemsRepository>

		currenciesRepository = {
			findById: jest.fn(),
			findByCode: jest.fn(),
			findPage: jest.fn(),
		} as jest.Mocked<ICurrenciesRepository>

		logger = {
			setContext: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as unknown as jest.Mocked<LoggerService>

		service = new SystemsService(systemsRepository, currenciesRepository, logger)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('create', () => {
		const createDto: CreateSystemInput = {
			currencyId: 1,
			description: 'US Dollar System',
		}

		it('should create a new system successfully', async () => {
			currenciesRepository.findById.mockResolvedValue(mockCurrency)
			systemsRepository.create.mockResolvedValue(mockSystem)

			const result = await service.create(1, createDto)

			expect(result).toEqual(mockSystem)
			expect(currenciesRepository.findById).toHaveBeenCalledWith(1)
			expect(systemsRepository.create).toHaveBeenCalledWith(1, createDto)
			expect(logger.info).toHaveBeenCalled()
		})

		it('should throw BadRequestException when currency does not exist', async () => {
			currenciesRepository.findById.mockResolvedValue(null)

			await expect(service.create(1, createDto)).rejects.toThrow(BadRequestException)

			expect(currenciesRepository.findById).toHaveBeenCalledWith(1)
			expect(systemsRepository.create).not.toHaveBeenCalled()
		})

		it('should propagate errors from repository', async () => {
			currenciesRepository.findById.mockResolvedValue(mockCurrency)
			const error = new Error('Database error')
			systemsRepository.create.mockRejectedValue(error)

			await expect(service.create(1, createDto)).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})

	describe('update', () => {
		const updateDto = { description: 'Updated System' }

		it('should update an existing system successfully', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			const updatedSystem = { ...mockSystem, description: 'Updated System' }
			systemsRepository.update.mockResolvedValue(updatedSystem)

			const result = await service.update(1, '1', updateDto)

			expect(result).toEqual(updatedSystem)
			expect(systemsRepository.findByIdInCountry).toHaveBeenCalledWith(1, '1')
			expect(systemsRepository.update).toHaveBeenCalledWith('1', updateDto)
		})

		it('should throw NotFoundException when system does not exist', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(null)

			await expect(service.update(1, '999', updateDto)).rejects.toThrow(NotFoundException)

			expect(systemsRepository.update).not.toHaveBeenCalled()
		})

		it('should validate currency when currencyId is provided', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(mockCurrency)
			systemsRepository.update.mockResolvedValue({ ...mockSystem, currencyId: 2 })

			await service.update(1, '1', { currencyId: 2 })

			expect(currenciesRepository.findById).toHaveBeenCalledWith(2)
		})

		it('should throw BadRequestException when new currency does not exist', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(null)

			await expect(service.update(1, '1', { currencyId: 999 })).rejects.toThrow(
				BadRequestException,
			)

			expect(systemsRepository.update).not.toHaveBeenCalled()
		})

		it('should propagate errors from repository', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			const error = new Error('Database error')
			systemsRepository.update.mockRejectedValue(error)

			await expect(service.update(1, '1', updateDto)).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})

	describe('findByIdInCountry', () => {
		it('should return system when found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)

			const result = await service.findByIdInCountry(1, '1')

			expect(result).toEqual(mockSystem)
			expect(systemsRepository.findByIdInCountry).toHaveBeenCalledWith(1, '1')
			expect(logger.info).toHaveBeenCalled()
		})

		it('should return null when system not found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(null)

			const result = await service.findByIdInCountry(1, '999')

			expect(result).toBeNull()
			expect(logger.info).toHaveBeenCalled()
		})

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error')
			systemsRepository.findByIdInCountry.mockRejectedValue(error)

			await expect(service.findByIdInCountry(1, '1')).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})

	describe('findPageByCountry', () => {
		it('should return paginated systems from repository', async () => {
			const mockSystems = [
				mockSystem,
				{ ...mockSystem, id: '2', description: 'Euro System', currencyId: 2 },
			]

			systemsRepository.findPageByCountry.mockResolvedValue({
				items: mockSystems,
				total: 5,
			})

			const result = await service.findPageByCountry(1, { offset: 0, limit: 25 })

			expect(result.systems).toEqual(mockSystems)
			expect(result.total).toBe(5)
			expect(systemsRepository.findPageByCountry).toHaveBeenCalledWith(1, { offset: 0, limit: 25 })
			expect(logger.info).toHaveBeenCalled()
		})

		it('should handle empty result set', async () => {
			systemsRepository.findPageByCountry.mockResolvedValue({
				items: [],
				total: 0,
			})

			const result = await service.findPageByCountry(1, { offset: 0, limit: 25 })

			expect(result.systems).toEqual([])
			expect(result.total).toBe(0)
		})

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error')
			systemsRepository.findPageByCountry.mockRejectedValue(error)

			await expect(service.findPageByCountry(1, { offset: 0, limit: 25 })).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})

	describe('getCurrency', () => {
		it('should return currency for a system', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(mockCurrency)

			const result = await service.getCurrency(1, '1')

			expect(result).toEqual(mockCurrency)
			expect(systemsRepository.findByIdInCountry).toHaveBeenCalledWith(1, '1')
			expect(currenciesRepository.findById).toHaveBeenCalledWith(1)
			expect(logger.info).toHaveBeenCalled()
		})

		it('should throw NotFoundException when system not found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(null)

			await expect(service.getCurrency(1, '999')).rejects.toThrow(NotFoundException)

			expect(currenciesRepository.findById).not.toHaveBeenCalled()
		})

		it('should throw NotFoundException when currency not found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(null)

			await expect(service.getCurrency(1, '1')).rejects.toThrow(NotFoundException)
		})

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error')
			systemsRepository.findByIdInCountry.mockRejectedValue(error)

			await expect(service.getCurrency(1, '1')).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})
})
