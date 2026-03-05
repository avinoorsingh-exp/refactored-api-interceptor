import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for creating a new Company.
 */
export class CreateCompanyDto {
	/**
	 * Company name
	 */
	@ApiProperty({
		description: 'Company name',
		example: 'Acme Corporation',
		minLength: 2,
		maxLength: 255,
	})
	name!: string

	/**
	 * Company email address
	 */
	@ApiProperty({
		description: 'Company email address',
		example: 'contact@acme.com',
		format: 'email',
	})
	email!: string
}
