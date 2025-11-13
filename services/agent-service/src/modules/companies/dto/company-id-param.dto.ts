import { ApiProperty } from '@nestjs/swagger'
import type { CompanyIdParam } from '@exprealty/shared-domain'
/**
 * DTO for company ID path parameter.
 * Validation is handled by ZodValidationPipe using CompanyIdParamSchema.
 * This class exists primarily for Swagger API documentation.
 */
export class CompanyIdParamDto implements CompanyIdParam {
	@ApiProperty({
		description: 'Company UUID identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	id!: string
}
