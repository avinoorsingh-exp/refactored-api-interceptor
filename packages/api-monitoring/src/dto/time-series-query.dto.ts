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
		description: 'Filter by HTTP method(s). Supports single value or array for multi-select.',
		enum: HttpMethod,
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) => Array.isArray(value) ? value : value ? [value] : undefined)
	@IsArray()
	@IsEnum(HttpMethod, { each: true })
	method?: HttpMethod | HttpMethod[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP status code(s). Filters stats that include any of these status codes. Supports single value or array for multi-select.',
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

