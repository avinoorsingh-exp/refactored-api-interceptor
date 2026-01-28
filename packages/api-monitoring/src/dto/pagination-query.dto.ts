import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Reusable pagination query DTO.
 * 
 * All fields are optional to maintain backward compatibility.
 * If no pagination params are provided, endpoints return existing behavior.
 * 
 * @public
 */
export class PaginationQueryDto {
	/**
	 * Maximum number of results to return.
	 * Default varies by endpoint (see endpoint documentation).
	 * Use -1 or 0 to fetch all results (no limit).
	 * Maximum: 100000 for safety.
	 */
	@ApiPropertyOptional({
		description: 'Maximum number of results to return. Use -1 or 0 to fetch all results (no limit).',
		example: 50,
		minimum: -1,
		maximum: 100000,
		default: 50,
	})
	@IsOptional()
	@IsInt()
	@Min(-1)
	@Max(100000)
	@Type(() => Number)
	limit?: number;

	/**
	 * Opaque cursor string for pagination.
	 * Used to fetch the next page of results.
	 * 
	 * Format: base64-encoded JSON containing timestamp and id
	 */
	@ApiPropertyOptional({
		description: 'Cursor for pagination (opaque string)',
		example: 'eyJ0aW1lc3RhbXAiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiIsImlkIjoiMTIzIn0=',
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

