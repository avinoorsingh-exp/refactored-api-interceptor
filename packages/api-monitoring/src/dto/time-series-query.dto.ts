import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { HttpMethod, TimeBucket } from '@exprealty/shared-domain';

/**
 * DTO for time-series metrics query.
 * @public
 */
export class TimeSeriesQueryDto {
	@ApiProperty({
		description: 'Start time for the query',
		example: '2024-01-01T00:00:00Z',
	})
	@IsDate()
	@Type(() => Date)
	@Transform(({ value }) => {
		if (typeof value === 'string') {
			return new Date(value);
		}
		return value;
	})
	startTime!: Date;

	@ApiProperty({
		description: 'End time for the query',
		example: '2024-01-02T00:00:00Z',
	})
	@IsDate()
	@Type(() => Date)
	@Transform(({ value }) => {
		if (typeof value === 'string') {
			return new Date(value);
		}
		return value;
	})
	endTime!: Date;

	@ApiPropertyOptional({
		description: 'Filter by route(s). Supports single value, array, or comma-separated list (e.g. route=/v1/agents,/v1/agents/:id). Works regardless of query parser collapsing repeated params.',
		example: '/v1/agents',
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null) return undefined;
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
		const s = String(value).trim();
		if (!s) return undefined;
		return s.split(',').map((r) => r.trim()).filter(Boolean);
	})
	@IsArray()
	@IsString({ each: true })
	route?: string | string[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP method(s). Supports single value, array, or comma-separated list (e.g. method=GET,POST). Works regardless of query parser collapsing repeated params.',
		enum: HttpMethod,
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null) return undefined;
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
		const s = String(value).trim();
		if (!s) return undefined;
		return s.split(',').map((m) => m.trim()).filter(Boolean);
	})
	@IsArray()
	@IsEnum(HttpMethod, { each: true })
	method?: HttpMethod | HttpMethod[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s). Supports single value, array, or comma-separated list (e.g. statusCode=200,404). Works regardless of query parser collapsing repeated params.',
		example: 500,
		type: [Number],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value == null) return undefined;
		const raw = Array.isArray(value) ? value : [value];
		const expanded = raw.flatMap((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean));
		if (expanded.length === 0) return undefined;
		return expanded.map((v) => parseInt(v, 10));
	})
	@IsArray()
	@IsInt({ each: true })
	statusCode?: number | number[];

	@ApiPropertyOptional({
		description: 'Time bucket for aggregation. If not provided, automatically selected based on time range: < 1 hour → minute, 1-24 hours → hour, > 24 hours → day',
		enum: TimeBucket,
	})
	@IsOptional()
	@IsEnum(TimeBucket)
	timeBucket?: TimeBucket;

	@ApiPropertyOptional({
		description: 'Filter by actor ID',
		format: 'uuid',
	})
	@IsOptional()
	@IsString()
	actorId?: string;
}

