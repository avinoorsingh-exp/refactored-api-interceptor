import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { SystemsController } from './systems.controller.js'
import { SystemsService } from './systems.service.js'
import { PaginationModule } from '../../../common/pagination/pagination.module.js'
import type { ISystemsRepository } from './ports/systems.repository.port.js'
import type { ICurrenciesRepository } from '../../currencies/ports/currencies.repository.port.js'
import type { System, Currency, CreateSystemInput } from '@exprealty/shared-domain'
import type { Response } from 'express'
import { LoggerService } from '../../../core/logger.service.js'
import { CountryExistsGuard } from '../../../common/guards/country-exists.guard.js'

describe('SystemsController', () => {
	let controller: SystemsController
	let service: SystemsService
	let systemsRepository: jest.Mocked<ISystemsRepository>
	let currenciesRepository: jest.Mocked<ICurrenciesRepository>

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

	const mockRequest = (): any => ({
		headers: { 'x-correlation-id': 'test-123' },
		country: { id: 1, name: 'United States', alpha2: 'US' },
	})

	const mockResponse = () => {
		const res: Partial<Response> = {
			setHeader: jest.fn(),
			status: jest.fn().mockReturnThis(),
		}
		return res as Response
	}

	beforeEach(async () => {
		systemsRepository = {
			findById: jest.fn(),
			findByIdInCountry: jest.fn(),
			findPageByCountry: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		}

		currenciesRepository = {
			findById: jest.fn(),
			findByCode: jest.fn(),
			findPage: jest.fn(),
		}

		const module: TestingModule = await Test.createTestingModule({
			imports: [PaginationModule],
			controllers: [SystemsController],
			providers: [
				SystemsService,
				{
					provide: 'ISystemsRepository',
					useValue: systemsRepository,
				},
				{
					provide: 'ICurrenciesRepository',
					useValue: currenciesRepository,
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
				{
					provide: 'COUNTRIES_SERVICE',
					useValue: {
						findById: jest.fn(),
					},
				},
			],
		})
			.overrideGuard(CountryExistsGuard)
			.useValue({ canActivate: () => true })
			.compile()

		controller = module.get<SystemsController>(SystemsController)
		service = module.get<SystemsService>(SystemsService)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('GET /v1/countries/:countryId/systems (findAll)', () => {
		it('should return paginated systems for a country', async () => {
			const mockSystems = [
				mockSystem,
				{ ...mockSystem, id: '2', description: 'Euro System' },
			]

			systemsRepository.findPageByCountry.mockResolvedValue({
				items: mockSystems,
				total: 5,
			})

			const req = mockRequest()
			const result = await controller.findAll({ countryId: 1 }, { offset: 0, limit: 25 }, req)

			expect(result).toEqual({
				items: mockSystems,
				total: 5,
			})
			expect(systemsRepository.findPageByCountry).toHaveBeenCalledWith(1, { offset: 0, limit: 25 })
		})

		it('should handle empty result set', async () => {
			systemsRepository.findPageByCountry.mockResolvedValue({
				items: [],
				total: 0,
			})

			const req = mockRequest()
			const result = await controller.findAll({ countryId: 1 }, {}, req)

			expect(result.items).toEqual([])
			expect(result.total).toBe(0)
		})

		it('should propagate errors from service', async () => {
			const error = new Error('Database connection failed')
			systemsRepository.findPageByCountry.mockRejectedValue(error)

			const req = mockRequest()

			await expect(controller.findAll({ countryId: 1 }, {}, req)).rejects.toThrow(error)
		})
	})

	describe('GET /v1/countries/:countryId/systems/:systemId (findById)', () => {
		it('should return a system when found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)

			const req = mockRequest()
			const result = await controller.findById({ countryId: 1, systemId: '1' }, req)

			expect(result).toEqual(mockSystem)
			expect(systemsRepository.findByIdInCountry).toHaveBeenCalledWith(1, '1')
		})

		it('should throw NotFoundException when system not found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(null)

			const req = mockRequest()

			await expect(
				controller.findById({ countryId: 1, systemId: '999' }, req),
			).rejects.toThrow(NotFoundException)
		})

		it('should propagate errors from service', async () => {
			const error = new Error('Database connection failed')
			systemsRepository.findByIdInCountry.mockRejectedValue(error)

			const req = mockRequest()

			await expect(
				controller.findById({ countryId: 1, systemId: '1' }, req),
			).rejects.toThrow(error)
		})
	})

	describe('POST /v1/countries/:countryId/systems (create)', () => {
		const createDto: CreateSystemInput = {
			currencyId: 1,
			description: 'New System',
		}

		it('should create a new system successfully', async () => {
			currenciesRepository.findById.mockResolvedValue(mockCurrency)
			systemsRepository.create.mockResolvedValue(mockSystem)

			const req = mockRequest()
			const res = mockResponse()
			const result = await controller.create({ countryId: 1 }, createDto, res, req)

			expect(result).toEqual(mockSystem)
			expect(systemsRepository.create).toHaveBeenCalledWith(1, createDto)
			expect(res.setHeader).toHaveBeenCalledWith('Location', '/v1/countries/1/systems/1')
		})

		it('should throw BadRequestException when currency does not exist', async () => {
			currenciesRepository.findById.mockResolvedValue(null)

			const req = mockRequest()
			const res = mockResponse()

			await expect(controller.create({ countryId: 1 }, createDto, res, req)).rejects.toThrow(
				BadRequestException,
			)
		})

		it('should propagate errors from service', async () => {
			currenciesRepository.findById.mockResolvedValue(mockCurrency)
			const error = new Error('Database connection failed')
			systemsRepository.create.mockRejectedValue(error)

			const req = mockRequest()
			const res = mockResponse()

			await expect(controller.create({ countryId: 1 }, createDto, res, req)).rejects.toThrow(error)
		})
	})

	describe('PUT /v1/countries/:countryId/systems/:systemId (update)', () => {
		const updateDto = { description: 'Updated System' }

		it('should update an existing system successfully', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			const updatedSystem = { ...mockSystem, description: 'Updated System' }
			systemsRepository.update.mockResolvedValue(updatedSystem)

			const req = mockRequest()
			const result = await controller.update(
				{ countryId: 1, systemId: '1' },
				updateDto,
				req,
			)

			expect(result).toEqual(updatedSystem)
			expect(systemsRepository.update).toHaveBeenCalledWith('1', updateDto)
		})

		it('should throw NotFoundException when system does not exist', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(null)

			const req = mockRequest()

			await expect(
				controller.update({ countryId: 1, systemId: '999' }, updateDto, req),
			).rejects.toThrow(NotFoundException)
		})

		it('should validate currency when currencyId is provided', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(null)

			const req = mockRequest()

			await expect(
				controller.update({ countryId: 1, systemId: '1' }, { currencyId: 999 }, req),
			).rejects.toThrow(BadRequestException)
		})

		it('should propagate errors from service', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			const error = new Error('Database connection failed')
			systemsRepository.update.mockRejectedValue(error)

			const req = mockRequest()

			await expect(
				controller.update({ countryId: 1, systemId: '1' }, updateDto, req),
			).rejects.toThrow(error)
		})
	})

	describe('GET /v1/countries/:countryId/systems/:systemId/currencies (getCurrency)', () => {
		it('should return currency for a system', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(mockCurrency)

			const req = mockRequest()
			const result = await controller.getCurrency({ countryId: 1, systemId: '1' }, req)

			expect(result).toEqual(mockCurrency)
			expect(systemsRepository.findByIdInCountry).toHaveBeenCalledWith(1, '1')
			expect(currenciesRepository.findById).toHaveBeenCalledWith(1)
		})

		it('should throw NotFoundException when system not found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(null)

			const req = mockRequest()

			await expect(
				controller.getCurrency({ countryId: 1, systemId: '999' }, req),
			).rejects.toThrow(NotFoundException)
		})

		it('should throw NotFoundException when currency not found', async () => {
			systemsRepository.findByIdInCountry.mockResolvedValue(mockSystem)
			currenciesRepository.findById.mockResolvedValue(null)

			const req = mockRequest()

			await expect(
				controller.getCurrency({ countryId: 1, systemId: '1' }, req),
			).rejects.toThrow(NotFoundException)
		})

		it('should propagate errors from service', async () => {
			const error = new Error('Database connection failed')
			systemsRepository.findByIdInCountry.mockRejectedValue(error)

			const req = mockRequest()

			await expect(
				controller.getCurrency({ countryId: 1, systemId: '1' }, req),
			).rejects.toThrow(error)
		})
	})
})
