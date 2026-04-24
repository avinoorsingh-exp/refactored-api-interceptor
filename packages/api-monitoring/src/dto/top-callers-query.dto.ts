import { ApiPropertyOptional } from '@nestjs/swagger';
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
		type: String,
		format: 'uuid',
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }: { value: unknown }): string[] => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		const arr = Array.isArray(value) ? value : [value];
		return arr.map((x) => String(x));
	})
	@IsArray()
	@IsString({ each: true })
	actorId?: string[];

	@ApiPropertyOptional({
		description: 'Filter by route(s). Supports single value, array, or comma-separated list (e.g. route=/v1/agents,/v1/agents/:id). Works regardless of query parser collapsing repeated params.',
		example: '/v1/agents',
		type: String,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }: { value: unknown }): string[] => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
		if (typeof value === 'string') {
			const s = value.trim();
			if (!s) return [];
			return s.split(',').map((r) => r.trim()).filter(Boolean);
		}
		return [];
	})
	@IsArray()
	@IsString({ each: true })
	route?: string[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s). Supports single value, array, or comma-separated list (e.g. statusCode=200,404). Works regardless of query parser collapsing repeated params.',
		example: 500,
		type: Number,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }: { value: unknown }): number[] => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		const raw = Array.isArray(value) ? value : [value];
		const expanded = raw.flatMap((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean));
		if (expanded.length === 0) return [];
		return expanded.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n));
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
	@Transform(({ value }: { value: unknown }): boolean => value === 'true' || value === true)
	debug?: boolean;
}

