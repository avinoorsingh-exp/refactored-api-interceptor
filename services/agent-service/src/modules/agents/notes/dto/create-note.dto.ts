import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new Note.
 * @public
 */
export class CreateNoteDto {
	@ApiProperty({ description: 'Note body text', example: 'Agent completed onboarding.' })
	body!: string;

	@ApiPropertyOptional({ description: 'User who created the note (defaults to system)', example: 'john.doe@example.com', default: 'system' })
	createdBy?: string;
}
