import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CurrenciesController } from './currencies.controller.js'
import { CurrenciesService } from './currencies.service.js'
import { PaginationModule } from '../../common/pagination/pagination.module.js'
import type { ICurrenciesRepository } from './ports/currencies.repository.port.js'
import type { Currency } from '@exprealty/shared-domain'
import type { Request } from 'express'
import { LoggerService } from '../../core/logger.service.js'

describe('CurrenciesController', () => {
	let controller: CurrenciesController
	let service: CurrenciesService
	let repository: jest.Mocked<ICurrenciesRepository>

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

	const mockRequest = (): any => ({
		headers: { 'x-correlation-id': 'test-123' },
	})

	beforeEach(async () => {
		repository = {
			findById: jest.fn(),
			findByCode: jest.fn(),
			findPage: jest.fn(),
		}

		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [CurrenciesController],
			providers: [
				CurrenciesService,
				{
					provide: 'ICurrenciesRepository',
					useValue: repository,
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
		}).compile()

		controller = module.get<CurrenciesController>(CurrenciesController)
		service = module.get<CurrenciesService>(CurrenciesService)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('GET /v1/currencies (findAll)', () => {
		it('should return paginated currencies', async () => {
			const mockCurrencies = [
				mockCurrency,
				{ ...mockCurrency, id: 2, code: 'EUR', number: 978, name: 'Euro', symbol: '€' },
			]

			repository.findPage.mockResolvedValue({
				items: mockCurrencies,
				total: 180,
			})

			const req = mockRequest()
			const result = await controller.findAll({ offset: 0, limit: 25 }, req)

			expect(result).toEqual({
				items: mockCurrencies,
				total: 180,
			})
			expect(repository.findPage).toHaveBeenCalled()
		})

		it('should return second page of currencies with correct offset', async () => {
			const mockCurrencies = [
				{ ...mockCurrency, id: 26, code: 'GBP', number: 826, name: 'Pound Sterling' },
			]

			repository.findPage.mockResolvedValue({
				items: mockCurrencies,
				total: 180,
			})

			const req = mockRequest()
			const result = await controller.findAll({ offset: 25, limit: 25 }, req)

			expect(result.items).toEqual(mockCurrencies)
			expect(result.total).toBe(180)
		})

		it('should handle empty result set', async () => {
			repository.findPage.mockResolvedValue({
				items: [],
				total: 0,
			})

			const req = mockRequest()
			const result = await controller.findAll({ offset: 1000, limit: 25 }, req)

			expect(result.items).toEqual([])
			expect(result.total).toBe(0)
		})

		it('should propagate errors from service', async () => {
			const error = new Error('Database connection failed')
			repository.findPage.mockRejectedValue(error)

			const req = mockRequest()

			await expect(controller.findAll({}, req)).rejects.toThrow(error)
		})
	})

	describe('GET /v1/currencies/:id (findById)', () => {
		it('should return a currency when found by ID', async () => {
			repository.findById.mockResolvedValue(mockCurrency)

			const req = mockRequest()
			const result = await controller.findById({ id: 1 }, req)

			expect(result).toEqual(mockCurrency)
			expect(repository.findById).toHaveBeenCalledWith(1)
		})

		it('should throw NotFoundException when currency not found', async () => {
			repository.findById.mockResolvedValue(null)

			const req = mockRequest()

			await expect(controller.findById({ id: 999 }, req)).rejects.toThrow(NotFoundException)

			expect(repository.findById).toHaveBeenCalledWith(999)
		})

		it('should propagate errors from service', async () => {
			const error = new Error('Database connection failed')
			repository.findById.mockRejectedValue(error)

			const req = mockRequest()

			await expect(controller.findById({ id: 1 }, req)).rejects.toThrow(error)
		})
	})

	describe('Error Handling', () => {
		it('should handle HttpException correctly in findAll', async () => {
			const error = new NotFoundException('Not found')
			repository.findPage.mockRejectedValue(error)

			const req = mockRequest()

			await expect(controller.findAll({}, req)).rejects.toThrow(NotFoundException)
		})

		it('should handle HttpException correctly in findById', async () => {
			const error = new NotFoundException('Not found')
			repository.findById.mockRejectedValue(error)

			const req = mockRequest()

			await expect(controller.findById({ id: 1 }, req)).rejects.toThrow(NotFoundException)
		})
	})
})
