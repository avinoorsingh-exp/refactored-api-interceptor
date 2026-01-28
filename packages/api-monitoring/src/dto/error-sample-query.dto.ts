import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsArray, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiErrorClassification } from '@exprealty/shared-domain';
import { PaginationQueryDto } from './pagination-query.dto.js';

/**
 * DTO for error sample query.
 * 
 * Extends PaginationQueryDto for cursor-based pagination support.
 * All pagination fields are optional for backward compatibility.
 * 
 * @public
 */
export class ErrorSampleQueryDto extends PaginationQueryDto {
	@ApiProperty({
		description: 'Start time for the query',
		example: '2024-01-01T00:00:00Z',
	})
	@IsDate()
	@Type(() => Date)
	startTime!: Date;

	@ApiProperty({
		description: 'End time for the query',
		example: '2024-01-02T00:00:00Z',
	})
	@IsDate()
	@Type(() => Date)
	endTime!: Date;

	@ApiPropertyOptional({
		description: 'Filter by error classification(s). Supports single value or array for multi-select.',
		enum: ApiErrorClassification,
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => Array.isArray(value) ? value : value ? [value] : undefined)
	@IsArray()
	@IsEnum(ApiErrorClassification, { each: true })
	classification?: ApiErrorClassification | ApiErrorClassification[];

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

	/**
	 * Filter by HTTP status code(s).
	 * Used for filtering by severity (4xx vs 5xx).
	 * Supports single value or array for multi-select.
	 */
	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s) (e.g., 404, 500). Supports single value or array for multi-select.',
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
		description: 'Enable debug mode to log filters, row counts, and cap application (non-breaking, DEBUG level only)',
		example: false,
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	debug?: boolean;
}

