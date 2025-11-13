import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for creating a new Region.
 * Validation is handled by ZodValidationPipe using CreateRegionInputSchema.
 * This class exists primarily for Swagger API documentation.
 */
export class CreateRegionDto {
	@ApiProperty({
		description: 'Region name',
		example: 'Pacific Northwest',
		minLength: 1,
		maxLength: 255,
	})
	name!: string
}
