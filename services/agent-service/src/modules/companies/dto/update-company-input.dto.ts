import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for updating a company.
 * Validation is handled by ZodValidationPipe using UpdateCompanyInputSchema.
 * This class exists primarily for Swagger API documentation.
 */
export class UpdateCompanyInputDto {
	@ApiProperty({
		description: 'Company name',
		example: 'Acme Corporation',
		minLength: 2,
		maxLength: 255,
	})
	name!: string

	@ApiProperty({
		description: 'Company email address',
		example: 'contact@acme.com',
		format: 'email',
	})
	email!: string
}
