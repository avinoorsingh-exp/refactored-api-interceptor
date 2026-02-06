import { CurrenciesService } from './currencies.service.js'
import type { ICurrenciesRepository } from './ports/currencies.repository.port.js'
import type { Currency } from '@exprealty/shared-domain'
import { LoggerService } from '../../core/logger.service.js'

/**
 * Unit tests for CurrenciesService
 * Tests findById, findByCode, findPage with mocked repository
 */
describe('CurrenciesService', () => {
	let service: CurrenciesService
	let repository: jest.Mocked<ICurrenciesRepository>
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

	beforeEach(() => {
		repository = {
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

		service = new CurrenciesService(repository, logger)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('findById', () => {
		it('should return currency when found by ID', async () => {
			repository.findById.mockResolvedValue(mockCurrency)

			const result = await service.findById(1)

			expect(result).toEqual(mockCurrency)
			expect(repository.findById).toHaveBeenCalledWith(1)
			expect(logger.info).toHaveBeenCalled()
		})

		it('should return null when currency not found by ID', async () => {
			repository.findById.mockResolvedValue(null)

			const result = await service.findById(999)

			expect(result).toBeNull()
			expect(repository.findById).toHaveBeenCalledWith(999)
			expect(logger.info).toHaveBeenCalled()
		})

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error')
			repository.findById.mockRejectedValue(error)

			await expect(service.findById(1)).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})

	describe('findByCode', () => {
		it('should return currency when found by code', async () => {
			repository.findByCode.mockResolvedValue(mockCurrency)

			const result = await service.findByCode('USD')

			expect(result).toEqual(mockCurrency)
			expect(repository.findByCode).toHaveBeenCalledWith('USD')
			expect(logger.info).toHaveBeenCalled()
		})

		it('should return null when currency not found by code', async () => {
			repository.findByCode.mockResolvedValue(null)

			const result = await service.findByCode('XXX')

			expect(result).toBeNull()
			expect(repository.findByCode).toHaveBeenCalledWith('XXX')
			expect(logger.info).toHaveBeenCalled()
		})

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error')
			repository.findByCode.mockRejectedValue(error)

			await expect(service.findByCode('USD')).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})

	describe('findPage', () => {
		it('should return paginated currencies from repository', async () => {
			const mockCurrencies = [
				mockCurrency,
				{ ...mockCurrency, id: 2, code: 'EUR', number: 978, name: 'Euro', symbol: '€' },
			]

			repository.findPage.mockResolvedValue({
				items: mockCurrencies,
				total: 180,
			})

			const result = await service.findPage({ offset: 0, limit: 25 })

			expect(result.currencies).toEqual(mockCurrencies)
			expect(result.total).toBe(180)
			expect(repository.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 })
			expect(logger.info).toHaveBeenCalled()
		})

		it('should handle pagination offset correctly', async () => {
			repository.findPage.mockResolvedValue({
				items: [mockCurrency],
				total: 180,
			})

			const result = await service.findPage({ offset: 25, limit: 25 })

			expect(result.currencies).toHaveLength(1)
			expect(result.total).toBe(180)
			expect(repository.findPage).toHaveBeenCalledWith({ offset: 25, limit: 25 })
		})

		it('should handle empty result set', async () => {
			repository.findPage.mockResolvedValue({
				items: [],
				total: 0,
			})

			const result = await service.findPage({ offset: 0, limit: 25 })

			expect(result.currencies).toEqual([])
			expect(result.total).toBe(0)
		})

		it('should pass filter, sort, and search to repository', async () => {
			repository.findPage.mockResolvedValue({
				items: [mockCurrency],
				total: 1,
			})

			const query = {
				offset: 0,
				limit: 25,
				filter: 'minorUnits:eq:2',
				sort: 'code:ASC',
				search: 'Dollar',
			}

			await service.findPage(query)

			expect(repository.findPage).toHaveBeenCalledWith(query)
		})

		it('should propagate errors from repository', async () => {
			const error = new Error('Database error')
			repository.findPage.mockRejectedValue(error)

			await expect(service.findPage({ offset: 0, limit: 25 })).rejects.toThrow(error)
			expect(logger.error).toHaveBeenCalled()
		})
	})
})
