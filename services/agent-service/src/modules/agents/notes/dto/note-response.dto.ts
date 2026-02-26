import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for Note entity.
 * @public
 */
export class NoteResponseDto {
	@ApiProperty({ description: 'Unique identifier (UUID)' })
	id!: string;

	@ApiProperty({ description: 'Note body text' })
	body!: string;

	@ApiProperty({ description: 'User who created the note', default: 'system' })
	createdBy!: string;

	@ApiProperty({ description: 'Creation timestamp' })
	created!: Date;

	@ApiProperty({ description: 'Last modification timestamp' })
	lastModified!: Date;

	@ApiPropertyOptional({ description: 'User who last modified the record' })
	modifiedBy?: string;
}
