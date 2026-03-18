import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a Note. All fields optional (partial update).
 * @public
 */
export class UpdateNoteDto {
	@ApiPropertyOptional({ description: 'Note body text', example: 'Updated note content.' })
	body?: string;

	@ApiPropertyOptional({ description: 'User who last modified the note', example: 'jane.doe@example.com' })
	modifiedBy?: string;
}
