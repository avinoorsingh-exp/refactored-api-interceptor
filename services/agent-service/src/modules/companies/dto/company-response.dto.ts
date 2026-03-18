import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * DTO for company response.
 * Used for API responses.
 * Per AC7: includes id, name, email, created, last_modified, modified_by
 * Note: email is optional to support legacy data migration
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

	@ApiPropertyOptional({
		description: 'Company email address',
		example: 'contact@acme.com',
		format: 'email',
		nullable: true,
	})
	email?: string | null

	@ApiProperty({
		description: 'Timestamp when the company was created',
		example: '2024-01-15T08:30:00.000Z',
	})
	created!: Date

	@ApiProperty({
		description: 'Timestamp when the company was last modified',
		example: '2024-01-20T14:45:00.000Z',
	})
	lastModified!: Date

	@ApiProperty({
		description: 'User or system that last modified the company',
		example: 'system',
	})
	modifiedBy!: string
}
