import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { CountriesService } from './countries.service.js'
import { CountryEntity } from '@exprealty/database'
import type { CreateCountryInput, Country } from '@exprealty/shared-domain'

describe('CountriesService', () => {
	let service: CountriesService
	let repository: jest.Mocked<Repository<CountryEntity>>

	const mockCountryEntity: CountryEntity = {
		countryId: 1,
		name: 'United States',
		alpha2: 'US',
		alpha3: 'USA',
		number: 840,
		dialingCode: 1,
	}

	const mockCountryInput: CreateCountryInput = {
		name: 'United States',
		alpha2: 'US',
		alpha3: 'USA',
		number: 840,
		dialingCode: 1,
	}

	const mockCountryResponse: Country = {
		countryId: 1,
		name: 'United States',
		alpha2: 'US',
		alpha3: 'USA',
		number: 840,
		dialingCode: 1,
	}

	beforeEach(async () => {
		const mockRepository = {
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
			upsert: jest.fn(),
		}

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CountriesService,
				{
					provide: getRepositoryToken(CountryEntity),
					useValue: mockRepository,
				},
			],
		}).compile()

		service = module.get<CountriesService>(CountriesService)
		repository = module.get(getRepositoryToken(CountryEntity))
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('create', () => {
		it('should successfully create a country', async () => {
			repository.create.mockReturnValue(mockCountryEntity)
			repository.save.mockResolvedValue(mockCountryEntity)

			const result = await service.create(mockCountryInput)

			expect(repository.create).toHaveBeenCalledWith({
				name: mockCountryInput.name,
				alpha2: mockCountryInput.alpha2,
				alpha3: mockCountryInput.alpha3,
				number: mockCountryInput.number,
				dialingCode: mockCountryInput.dialingCode,
			})
			expect(repository.save).toHaveBeenCalledWith(mockCountryEntity)
			expect(result).toEqual(mockCountryResponse)
		})

		it('should throw ConflictException for duplicate alpha2 code', async () => {
			const duplicateError = new QueryFailedError('', [], new Error())
			;(duplicateError as any).code = '23505'
			;(duplicateError as any).detail = 'Key (alpha_2)=(US) already exists.'

			repository.create.mockReturnValue(mockCountryEntity)
			repository.save.mockRejectedValue(duplicateError)

			await expect(service.create(mockCountryInput)).rejects.toThrow(
				ConflictException,
			)
		})

		it('should throw ConflictException for duplicate alpha3 code', async () => {
			const duplicateError = new QueryFailedError('', [], new Error())
			;(duplicateError as any).code = '23505'
			;(duplicateError as any).detail = 'Key (alpha_3)=(USA) already exists.'

			repository.create.mockReturnValue(mockCountryEntity)
			repository.save.mockRejectedValue(duplicateError)

			await expect(service.create(mockCountryInput)).rejects.toThrow(
				ConflictException,
			)
		})

		it('should throw ConflictException for duplicate number code', async () => {
			const duplicateError = new QueryFailedError('', [], new Error())
			;(duplicateError as any).code = '23505'
			;(duplicateError as any).detail = 'Key (number)=(840) already exists.'

			repository.create.mockReturnValue(mockCountryEntity)
			repository.save.mockRejectedValue(duplicateError)

			await expect(service.create(mockCountryInput)).rejects.toThrow(
				ConflictException,
			)
		})

		it('should rethrow non-duplicate database errors', async () => {
			const genericError = new Error('Database connection failed')

			repository.create.mockReturnValue(mockCountryEntity)
			repository.save.mockRejectedValue(genericError)

			await expect(service.create(mockCountryInput)).rejects.toThrow(
				'Database connection failed',
			)
		})
	})

	describe('findByCode', () => {
		it('should return a country when found', async () => {
			repository.findOne.mockResolvedValue(mockCountryEntity)

			const result = await service.findByCode('US')

			expect(repository.findOne).toHaveBeenCalledWith({
				where: { alpha2: 'US' },
			})
			expect(result).toEqual(mockCountryResponse)
		})

		it('should return null when country is not found', async () => {
			repository.findOne.mockResolvedValue(null)

			const result = await service.findByCode('XX')

			expect(repository.findOne).toHaveBeenCalledWith({
				where: { alpha2: 'XX' },
			})
			expect(result).toBeNull()
		})

		it('should rethrow database errors', async () => {
			const dbError = new Error('Database query failed')
			repository.findOne.mockRejectedValue(dbError)

			await expect(service.findByCode('US')).rejects.toThrow(
				'Database query failed',
			)
		})
	})

	describe('upsert', () => {
		it('should create a new country when it does not exist', async () => {
			repository.findOne
				.mockResolvedValueOnce(null) // First call: country doesn't exist
				.mockResolvedValueOnce(mockCountryEntity) // Second call: after upsert
			repository.upsert.mockResolvedValue({} as any)

			const result = await service.upsert(mockCountryInput)

			expect(repository.findOne).toHaveBeenCalledTimes(2)
			expect(repository.upsert).toHaveBeenCalledWith(mockCountryInput, {
				conflictPaths: ['alpha2'],
				skipUpdateIfNoValuesChanged: true,
			})
			expect(result.country).toEqual(mockCountryResponse)
			expect(result.created).toBe(true)
		})

		it('should update an existing country', async () => {
			const existingCountry = { ...mockCountryEntity, countryId: 5 }
			const updatedCountry = { ...mockCountryEntity, countryId: 5, name: 'United States of America' }

			repository.findOne
				.mockResolvedValueOnce(existingCountry) // First call: country exists
				.mockResolvedValueOnce(updatedCountry) // Second call: after upsert
			repository.upsert.mockResolvedValue({} as any)

			const result = await service.upsert({
				...mockCountryInput,
				name: 'United States of America',
			})

			expect(repository.upsert).toHaveBeenCalled()
			expect(result.country.countryId).toBe(5)
			expect(result.created).toBe(false)
		})

		it('should throw error if country is not found after upsert', async () => {
			repository.findOne
				.mockResolvedValueOnce(null) // First call: doesn't exist
				.mockResolvedValueOnce(null) // Second call: still null (error case)
			repository.upsert.mockResolvedValue({} as any)

			await expect(service.upsert(mockCountryInput)).rejects.toThrow(
				'Country not found after upsert: US',
			)
		})

		it('should rethrow database errors during upsert', async () => {
			const dbError = new Error('Upsert operation failed')
			repository.findOne.mockResolvedValue(null)
			repository.upsert.mockRejectedValue(dbError)

			await expect(service.upsert(mockCountryInput)).rejects.toThrow(
				'Upsert operation failed',
			)
		})
	})
})
