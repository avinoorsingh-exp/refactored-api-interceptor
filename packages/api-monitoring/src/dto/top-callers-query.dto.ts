import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsInt, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
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
	@ApiPropertyOptional({
		description: 'Start time for the query (ISO 8601 format)',
		example: '2024-01-01T00:00:00Z',
		type: String,
	})
	@IsOptional()
	@IsDateString()
	startTime?: string;

	@ApiPropertyOptional({
		description: 'End time for the query (ISO 8601 format)',
		example: '2024-01-02T00:00:00Z',
		type: String,
	})
	@IsOptional()
	@IsDateString()
	endTime?: string;

	@ApiPropertyOptional({
		description: 'Filter by actor ID(s). Supports single value or array for multi-select.',
		format: 'uuid',
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => Array.isArray(value) ? value : value ? [value] : undefined)
	@IsArray()
	@IsString({ each: true })
	actorId?: string | string[];

	@ApiPropertyOptional({
		description: 'Filter by route(s). Supports single value or array for multi-select.',
		example: '/v1/agents',
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => Array.isArray(value) ? value : value ? [value] : undefined)
	@IsArray()
	@IsString({ each: true })
	route?: string | string[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s). Supports single value or array for multi-select.',
		example: 500,
		type: [Number],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (!value) return undefined;
		const arr = Array.isArray(value) ? value : [value];
		return arr.map((v) => parseInt(v, 10));
	})
	@IsArray()
	@IsInt({ each: true })
	statusCode?: number | number[];

	@ApiPropertyOptional({
		description: 'Enable debug mode to log filters, row counts, and cap application (non-breaking, DEBUG level only)',
		example: false,
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	debug?: boolean;
}

