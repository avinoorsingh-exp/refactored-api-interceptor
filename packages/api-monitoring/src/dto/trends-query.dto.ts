import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, IsArray, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { HttpMethod } from '../domain/api-monitoring.types.js';
import { toArray } from '../utils/filter.util.js';

/**
 * Fixed time range options for trends.
 * @public
 */
export enum TrendsRange {
	DAYS_30 = 30,
	DAYS_60 = 60,
	DAYS_90 = 90,
}

/**
 * DTO for trends metrics query.
 * 
 * Fixed ranges: 30, 60, 90 days.
 * Accepts format: "30d", "60d", "90d" or just "30", "60", "90".
 * Uses daily buckets for ≤14 days, weekly buckets for >14 days.
 * 
 * Supports filtering by multiple routes and/or status codes.
 * 
 * @public
 */
export class TrendsQueryDto {
	@ApiProperty({
		description: 'Time range in days (30d, 60d, 90d or 30, 60, 90)',
		example: '30d',
		type: String,
	})
	@Transform(({ value }: { value: unknown }): TrendsRange => {
		// Parse "30d" -> 30, "60d" -> 60, etc.
		if (typeof value === 'string') {
			const num = parseInt(value.replace('d', ''), 10);
			if (num === 30 || num === 60 || num === 90) {
				return num;
			}
		}
		// If already a number, return as-is
		if (typeof value === 'number' && (value === 30 || value === 60 || value === 90)) {
			return value;
		}
		return value as TrendsRange;
	})
	@Matches(/^(30|60|90)d?$/, {
		message: 'Range must be 30d, 60d, 90d, 30, 60, or 90',
	})
	range!: TrendsRange;

	@ApiPropertyOptional({
		description: 'Filter by route(s). Can be a single route or array of routes.',
		example: '/v1/agents',
		type: String,
		isArray: true,
		nullable: true,
	})
	@Transform(({ value }: { value: unknown }): string[] =>
		value == null || (typeof value === 'string' && value.trim() === '')
			? []
			: toArray(value as string | string[]),
	)
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	route?: string[];

	@ApiPropertyOptional({
		description: 'Filter by HTTP method',
		enum: HttpMethod,
	})
	@IsOptional()
	@IsEnum(HttpMethod)
	method?: HttpMethod;

	@ApiPropertyOptional({
		description: 'Filter by status code(s). Can be a single status code or array of status codes.',
		example: 200,
		type: Number,
		isArray: true,
		nullable: true,
	})
	@Transform(({ value }) => (value == null || (typeof value === 'string' && value.trim() === '')) ? [] : toArray(value).map((v: string | number) => typeof v === 'string' ? parseInt(v, 10) : v))
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	statusCode?: number[];
}

