import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsArray, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { HttpMethod } from '@exprealty/shared-domain';

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
	startTime?: Date;

	@ApiPropertyOptional({
		description: 'End time for the query (defaults to now if not provided)',
		example: '2024-01-02T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
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
}

