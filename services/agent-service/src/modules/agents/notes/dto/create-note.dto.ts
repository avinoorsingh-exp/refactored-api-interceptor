import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating a new Note.
 * @public
 */
export class CreateNoteDto {
	@ApiProperty({ description: 'Note author/actor', example: 'john.doe@example.com' })
	actor!: string;

	@ApiProperty({ description: 'Note body text', example: 'Agent completed onboarding.' })
	body!: string;
}
