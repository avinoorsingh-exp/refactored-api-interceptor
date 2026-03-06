import { ApiProperty } from '@nestjs/swagger'
import type { SystemIdParam, CountryIdParam, CountrySystemParam } from '@exprealty/shared-domain'

/**
 * DTO for system ID path parameter.
 */
export class SystemIdParamDto implements SystemIdParam {
	/**
	 * System ID
	 * @example "1"
	 */
	@ApiProperty({
		description: 'System ID',
		example: '1',
	})
	systemId!: string
}

/**
 * DTO for country ID path parameter.
 */
export class CountryIdParamDto implements CountryIdParam {
	/**
	 * Country ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Country ID',
		example: 1,
	})
	countryId!: number
}

/**
 * DTO for combined country ID and system ID path parameters.
 * Used for routes like GET /v1/countries/:countryId/systems/:systemId
 */
export class CountrySystemParamDto implements CountrySystemParam {
	/**
	 * Country ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Country ID',
		example: 1,
	})
	countryId!: number

	/**
	 * System ID
	 * @example "1"
	 */
	@ApiProperty({
		description: 'System ID',
		example: '1',
	})
	systemId!: string
}
