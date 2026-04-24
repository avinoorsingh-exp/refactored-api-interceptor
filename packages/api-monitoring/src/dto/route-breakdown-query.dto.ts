import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsArray, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { HttpMethod } from '../domain/api-monitoring.types.js';

/**
 * DTO for route breakdown query.
 * 
 * If startTime/endTime are not provided, defaults to last 15 minutes.
 * @public
 */
export class RouteBreakdownQueryDto {
	@ApiPropertyOptional({
		description: 'Start time for the query (defaults to 15 minutes ago if not provided)',
		example: '2024-01-01T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	@Transform(({ value }: { value: unknown }): Date | undefined => {
		if (typeof value === 'string') {
			return new Date(value);
		}
		if (value instanceof Date) {
			return value;
		}
		return undefined;
	})
	startTime?: Date;

	@ApiPropertyOptional({
		description: 'End time for the query (defaults to now if not provided)',
		example: '2024-01-02T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	@Transform(({ value }: { value: unknown }): Date | undefined => {
		if (typeof value === 'string') {
			return new Date(value);
		}
		if (value instanceof Date) {
			return value;
		}
		return undefined;
	})
	endTime?: Date;

	@ApiPropertyOptional({
		description: 'Maximum number of results to return (ranking mode only). Default: 50, Max: 100. When route filter is present, this switches to inspection mode and limit is ignored.',
		example: 50,
		minimum: 1,
		maximum: 100,
		default: 50,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	limit?: number;

	@ApiPropertyOptional({
		description: 'Enable debug mode to log filters, row counts, and cap application (non-breaking, DEBUG level only)',
		example: false,
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	debug?: boolean;

	@ApiPropertyOptional({
		description: 'Filter by route(s). Supports single value, array, or comma-separated list (e.g. route=/v1/agents,/v1/agents/:id). Works regardless of query parser collapsing repeated route= params.',
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
		return s.split(',').map((r) => r.trim()).filter(Boolean);
	})
	@IsArray()
	@IsString({ each: true })
	route?: string[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP method(s). Supports single value, array, or comma-separated list (e.g. method=GET,POST). Works regardless of query parser collapsing repeated params.',
		enum: HttpMethod,
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null || (typeof value === 'string' && value.trim() === '')) return [];
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
		const s = String(value).trim();
		if (!s) return [];
		return s.split(',').map((m) => m.trim()).filter(Boolean);
	})
	@IsArray()
	@IsEnum(HttpMethod, { each: true })
	method?: HttpMethod[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s). Supports single value, array, or comma-separated list (e.g. statusCode=200,404). Works regardless of query parser collapsing repeated params.',
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
}

