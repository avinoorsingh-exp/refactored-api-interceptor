import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for company ID path parameter.
 * Validation is handled by ZodValidationPipe using CompanyIdParamSchema.
 * This class exists primarily for Swagger API documentation.
 */
export class CompanyIdParamDto {
	@ApiProperty({
		description: 'Company UUID identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	id!: string
}
