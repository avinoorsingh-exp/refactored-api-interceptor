import { ApiProperty } from '@nestjs/swagger';

/**
 * Pagination metadata DTO.
 * 
 * @public
 */
export class PageInfoDto {
	/**
	 * Cursor for the next page.
	 * null if there are no more results.
	 */
	@ApiProperty({
		description: 'Cursor for the next page. null if there are no more results.',
		nullable: true,
		example: 'eyJ0aW1lc3RhbXAiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiIsImlkIjoiMTIzIn0=',
	})
	nextCursor!: string | null;

	/**
	 * Whether there are more results available.
	 */
	@ApiProperty({
		description: 'Whether there are more results available',
		example: true,
	})
	hasMore!: boolean;
}

