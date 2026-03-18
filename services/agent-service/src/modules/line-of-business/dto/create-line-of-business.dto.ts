import { ApiProperty } from '@nestjs/swagger'
import type { CreateLineOfBusinessInput } from '@exprealty/shared-domain'

/**
 * DTO for creating a new LineOfBusiness.
 * Validated by ZodValidationPipe using CreateLineOfBusinessInputSchema.
 */
export class CreateLineOfBusinessDto implements CreateLineOfBusinessInput {
	/**
	 * Line of business name
	 * @example "residential"
	 */
	@ApiProperty({
		description: 'Line of business name',
		example: 'residential',
		minLength: 1,
		maxLength: 255,
	})
	name!: string
}
