import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsArray, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiErrorClassification } from '../domain/api-monitoring.types.js';
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
		description: 'Filter by error classification(s). Supports single value, array, or comma-separated list (e.g. classification=CLIENT_ERROR,SERVER_ERROR).',
		enum: ApiErrorClassification,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		const raw = Array.isArray(value) ? value : [value];
		const expanded = raw.flatMap((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean));
		return expanded.length > 0 ? expanded : [];
	})
	@IsArray()
	@IsEnum(ApiErrorClassification, { each: true })
	classification?: ApiErrorClassification[];

	@ApiPropertyOptional({
		description: 'Filter by route(s). Supports single value, array, or comma-separated list (e.g. route=/v1/agents,/v1/countries). Note: repeated route= params may collapse to one value by the query parser; use comma-separated for multiple routes.',
		example: '/v1/agents',
		type: String,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
		const s = String(value).trim();
		if (!s) return [];
		// Support comma-separated routes so multiple routes work regardless of query parser
		return s.split(',').map((r) => r.trim()).filter(Boolean);
	})
	@IsArray()
	@IsString({ each: true })
	route?: string[];

	/**
	 * Filter by HTTP status code(s).
	 * Used for filtering by severity (4xx vs 5xx).
	 * Supports single value, array, or comma-separated list (e.g. statusCode=200,400).
	 */
	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s) (e.g., 404, 500). Supports single value, array, or comma-separated list (e.g. statusCode=200,400).',
		example: 500,
		type: Number,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		const raw = Array.isArray(value) ? value : [value];
		const expanded = raw.flatMap((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean));
		if (expanded.length === 0) return [];
		return expanded.map((v) => parseInt(v, 10));
	})
	@IsArray()
	@IsInt({ each: true })
	statusCode?: number[];

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

