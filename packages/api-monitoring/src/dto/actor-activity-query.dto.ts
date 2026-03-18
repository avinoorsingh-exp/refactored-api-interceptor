import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsInt, IsOptional, IsUUID, IsString, IsArray, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationQueryDto } from './pagination-query.dto.js';

/**
 * DTO for actor activity query.
 * 
 * Extends PaginationQueryDto for cursor-based pagination support.
 * All pagination fields are optional for backward compatibility.
 * 
 * @public
 */
export class ActorActivityQueryDto extends PaginationQueryDto {
	@ApiProperty({
		description: 'Actor ID (UUID)',
		format: 'uuid',
	})
	@IsUUID()
	actorId!: string;

	@ApiPropertyOptional({
		description: 'Start time for the query',
		example: '2024-01-01T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	startTime?: Date;

	@ApiPropertyOptional({
		description: 'End time for the query',
		example: '2024-01-02T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	endTime?: Date;

	/**
	 * Legacy limit field (deprecated, use limit from PaginationQueryDto).
	 * Kept for backward compatibility.
	 * 
	 * @deprecated Use limit from PaginationQueryDto instead
	 */
	@ApiPropertyOptional({
		description: 'Maximum number of results (deprecated, use limit)',
		default: 50,
		minimum: 1,
		maximum: 100,
		deprecated: true,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	legacyLimit?: number;

	@ApiPropertyOptional({
		description: 'Filter by route(s). Supports single value or array for multi-select.',
		example: '/v1/agents',
		type: String,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		return Array.isArray(value) ? value : [value];
	})
	@IsArray()
	@IsString({ each: true })
	route?: string[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s). Supports single value or array for multi-select.',
		example: 500,
		type: Number,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		const arr = Array.isArray(value) ? value : [value];
		return arr.map((v) => parseInt(v, 10));
	})
	@IsArray()
	@IsInt({ each: true })
	statusCode?: number[];

	@ApiPropertyOptional({
		description: 'Enable debug mode to log filters, row counts, and cap application (non-breaking, DEBUG level only)',
		example: false,
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	debug?: boolean;
}

