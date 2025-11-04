import { ApiProperty } from '@nestjs/swagger'
import type { CountryCodeParam } from '@exprealty/shared-domain'

/**
 * DTO for country code path parameter.
 * Uses Zod schema validation via ZodValidationPipe.
 * @ApiProperty decorators are for Swagger documentation only.
 */
export class CountryCodeParamDto implements CountryCodeParam {
	@ApiProperty({
		description: 'Country alpha-2 code (ISO 3166-1)',
		example: 'US',
		pattern: '^[A-Z]{2}$',
	})
	code!: string
}
