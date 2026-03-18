import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new ContactMethod.
 * @public
 */
export class CreateContactMethodDto {
	@ApiProperty({ description: 'Contact method name/label (unique)', example: 'Primary Email' })
	name!: string;

	@ApiProperty({ description: 'Communication channel type', enum: ['email', 'phone'], example: 'email' })
	channel!: 'email' | 'phone';

	@ApiPropertyOptional({ description: 'Contact method sub-type', enum: ['mobile', 'home', 'work', 'fax', 'personal'], example: 'work' })
	subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal';

	@ApiProperty({ description: 'Contact value (email address or phone number)', example: 'john.doe@example.com' })
	value!: string;

	@ApiProperty({ description: 'Whether this is the primary contact method', example: true })
	isPrimary!: boolean;

	@ApiPropertyOptional({ description: 'Whether user has opted in for SMS notifications', example: false })
	smsOptIn?: boolean;
}
