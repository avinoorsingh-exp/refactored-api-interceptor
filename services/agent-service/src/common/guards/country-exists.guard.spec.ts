import { NotFoundException } from '@nestjs/common'
import { ExecutionContext } from '@nestjs/common'
import { CountryExistsGuard } from './country-exists.guard.js'
import type { CountriesService } from '../../modules/countries/countries.service.js'
import type { Country } from '@exprealty/shared-domain'

/**
 * Unit tests for CountryExistsGuard
 */
describe('CountryExistsGuard', () => {
	let guard: CountryExistsGuard
	let countriesService: jest.Mocked<CountriesService>

	const mockCountry: Country = {
		id: 1,
		name: 'United States',
		alpha2: 'US',
		alpha3: 'USA',
		number: 840,
		dialingCode: 1,
		created: new Date('2024-01-15T10:30:00Z'),
		lastModified: new Date('2024-01-15T14:45:00Z'),
		modifiedBy: 'system',
	}

	const createMockExecutionContext = (params: Record<string, string> = {}): ExecutionContext => {
		const mockRequest = {
			params,
		}

		return {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
		} as ExecutionContext
	}

	beforeEach(() => {
		countriesService = {
			findById: jest.fn(),
			findByCode: jest.fn(),
			findPage: jest.fn(),
			create: jest.fn(),
			upsert: jest.fn(),
		} as unknown as jest.Mocked<CountriesService>

		guard = new CountryExistsGuard(countriesService)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('canActivate', () => {
		it('should return true and attach country to request when country exists', async () => {
			countriesService.findById.mockResolvedValue(mockCountry)
			const context = createMockExecutionContext({ countryId: '1' })

			const result = await guard.canActivate(context)

			expect(result).toBe(true)
			expect(countriesService.findById).toHaveBeenCalledWith(1)

			const request = context.switchToHttp().getRequest()
			expect(request.country).toEqual(mockCountry)
		})

		it('should return true when no countryId in params', async () => {
			const context = createMockExecutionContext({})

			const result = await guard.canActivate(context)

			expect(result).toBe(true)
			expect(countriesService.findById).not.toHaveBeenCalled()
		})

		it('should throw NotFoundException when country does not exist', async () => {
			countriesService.findById.mockResolvedValue(null)
			const context = createMockExecutionContext({ countryId: '999' })

			await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException)
			expect(countriesService.findById).toHaveBeenCalledWith(999)
		})

		it('should throw NotFoundException for invalid countryId (non-numeric)', async () => {
			const context = createMockExecutionContext({ countryId: 'abc' })

			await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException)
			expect(countriesService.findById).not.toHaveBeenCalled()
		})

		it('should throw NotFoundException for invalid countryId (zero)', async () => {
			const context = createMockExecutionContext({ countryId: '0' })

			await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException)
			expect(countriesService.findById).not.toHaveBeenCalled()
		})

		it('should throw NotFoundException for invalid countryId (negative)', async () => {
			const context = createMockExecutionContext({ countryId: '-1' })

			await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException)
			expect(countriesService.findById).not.toHaveBeenCalled()
		})

		it('should throw NotFoundException when service throws error', async () => {
			countriesService.findById.mockRejectedValue(new Error('Database error'))
			const context = createMockExecutionContext({ countryId: '1' })

			await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException)
		})

		it('should re-throw NotFoundException from service as-is', async () => {
			const notFoundError = new NotFoundException({
				message: 'Country not found',
				i18nType: 'country.not_found',
			})
			countriesService.findById.mockRejectedValue(notFoundError)
			const context = createMockExecutionContext({ countryId: '1' })

			await expect(guard.canActivate(context)).rejects.toThrow(notFoundError)
		})
	})
})
