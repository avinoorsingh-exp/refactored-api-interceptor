import {
	Injectable,
	CanActivate,
	ExecutionContext,
	NotFoundException,
	Inject,
} from '@nestjs/common'
import type { CountriesService } from '../../modules/countries/countries.service.js'

/**
 * Country Exists Guard
 *
 * Validates that the country in route params exists.
 * Use on controllers/routes with :countryId parameter.
 *
 * Benefits:
 * - Clean REST semantics (404 if country doesn't exist)
 * - DRY - No duplicate validation code
 * - Fail fast - Before entering controller logic
 * - Attaches validated country to request for reuse
 */
@Injectable()
export class CountryExistsGuard implements CanActivate {
	constructor(
		@Inject('COUNTRIES_SERVICE')
		private readonly countriesService: CountriesService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest()

		// Get country ID from params
		const countryId = request.params.countryId

		if (!countryId) {
			// No country ID in params - let it pass (not our concern)
			return true
		}

		// Parse and validate the country ID
		const parsedId = parseInt(countryId, 10)
		if (isNaN(parsedId) || parsedId <= 0) {
			throw new NotFoundException({
				message: `Country with ID '${countryId}' not found`,
				i18nType: 'country.not_found',
			})
		}

		// Validate country exists using CountriesService.findById
		try {
			const country = await this.countriesService.findById(parsedId)

			if (!country) {
				throw new NotFoundException({
					message: `Country with ID '${countryId}' not found`,
					i18nType: 'country.not_found',
				})
			}

			// Attach country to request for reuse by @CountryParam() decorator
			request.country = country

			return true
		} catch (error) {
			// Re-throw NotFoundException from service as-is
			if (error instanceof NotFoundException) {
				throw error
			}

			// Transform other errors to 404 with clear message
			throw new NotFoundException({
				message: `Country with ID '${countryId}' not found`,
				i18nType: 'country.not_found',
			})
		}
	}
}
