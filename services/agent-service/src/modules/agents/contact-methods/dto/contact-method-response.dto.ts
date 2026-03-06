import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for ContactMethod entity.
 * @public
 */
export class ContactMethodResponseDto {
	@ApiProperty({ description: 'Unique identifier (BigInt as string)' })
	id!: string;

	@ApiProperty({ description: 'Contact method name/label (unique)' })
	name!: string;

	@ApiProperty({ description: 'Communication channel type', enum: ['email', 'phone'] })
	channel!: 'email' | 'phone';

	@ApiPropertyOptional({ description: 'Contact method sub-type', enum: ['mobile', 'home', 'work', 'fax', 'personal'] })
	subType?: 'mobile' | 'home' | 'work' | 'fax' | 'personal';

	@ApiProperty({ description: 'Contact value (email address or phone number)' })
	value!: string;

	@ApiProperty({ description: 'Whether this is the primary contact method' })
	isPrimary!: boolean;

	@ApiPropertyOptional({ description: 'Whether user has opted in for SMS notifications' })
	smsOptIn?: boolean;

	@ApiProperty({ description: 'Foreign key to Agent entity' })
	agentId!: string;

	@ApiProperty({ description: 'Creation timestamp' })
	created!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	lastModified!: Date;

	@ApiPropertyOptional({ description: 'User who last modified the record' })
	modifiedBy?: string;
}
