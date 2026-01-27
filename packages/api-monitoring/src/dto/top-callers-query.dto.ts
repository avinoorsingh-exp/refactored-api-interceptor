import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto.js';

/**
 * DTO for top callers query.
 * 
 * Extends PaginationQueryDto for cursor-based pagination support.
 * All pagination fields are optional for backward compatibility.
 * 
 * @public
 */
export class TopCallersQueryDto extends PaginationQueryDto {
	@ApiProperty({
		description: 'Start time for the query (ISO 8601 format)',
		example: '2024-01-01T00:00:00Z',
		type: String,
	})
	@IsDateString()
	startTime!: string;

	@ApiProperty({
		description: 'End time for the query (ISO 8601 format)',
		example: '2024-01-02T00:00:00Z',
		type: String,
	})
	@IsDateString()
	endTime!: string;
}

