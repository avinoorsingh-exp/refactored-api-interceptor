import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for company response.
 * Used for API responses.
 */
export class CompanyResponseDto {
	@ApiProperty({
		description: 'Company UUID',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	id!: string

	@ApiProperty({
		description: 'Company name',
		example: 'Acme Corporation',
	})
	name!: string

	@ApiProperty({
		description: 'Company email address',
		example: 'contact@acme.com',
		format: 'email',
	})
	email!: string

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2024-01-15T10:30:00Z',
		format: 'date-time',
	})
	createdAt!: Date

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2024-01-20T14:45:00Z',
		format: 'date-time',
	})
	updatedAt!: Date
}
