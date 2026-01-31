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

	/**
	 * Total number of items matching the query (across all pages).
	 * For top-callers, this is the total number of unique actors.
	 * null if the total count is not available or not calculated.
	 */
	@ApiProperty({
		description: 'Total number of items matching the query (across all pages). For top-callers, this is the total number of unique actors. null if not available.',
		nullable: true,
		example: 8936,
	})
	total?: number | null;

	/**
	 * Total number of requests in the time range.
	 * This helps explain why the sum of requestCounts from returned results
	 * may not equal this value (due to pagination limits).
	 * null if not available.
	 */
	@ApiProperty({
		description: 'Total number of requests in the time range. This helps explain why the sum of requestCounts may not equal this value. null if not available.',
		nullable: true,
		example: 9155,
	})
	totalRequests?: number | null;

	/**
	 * Actor display name (for actor activity endpoint).
	 * Present when all results are for the same actor.
	 * null if not applicable.
	 */
	@ApiProperty({
		description: 'Actor display name (for actor activity endpoint). Present when all results are for the same actor.',
		nullable: true,
		example: 'API Key: Zapier',
		required: false,
	})
	displayName?: string | null;
}

