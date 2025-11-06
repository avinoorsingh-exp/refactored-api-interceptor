import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for company response.
 * Used for API responses.
 * Per AC7: includes id, name, legal_name (if present), is_active, created_at, updated_at
 */
export class CompanyResponseDto {
	@ApiProperty({
		description: 'Company ID',
		example: '1',
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
		description: 'Timestamp when the company was created',
		example: '2024-01-15T08:30:00.000Z',
		type: String,
	})
	created_at!: string

	@ApiProperty({
		description: 'Timestamp when the company was last updated',
		example: '2024-01-20T14:45:00.000Z',
		type: String,
	})
	updated_at!: string
}
