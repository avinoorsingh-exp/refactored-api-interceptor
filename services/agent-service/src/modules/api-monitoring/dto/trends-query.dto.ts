import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { HttpMethod } from '@exprealty/shared-domain';

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
 * @public
 */
export class TrendsQueryDto {
	@ApiProperty({
		description: 'Time range in days (30d, 60d, 90d or 30, 60, 90)',
		example: '30d',
		type: String,
	})
	@Transform(({ value }) => {
		// Parse "30d" -> 30, "60d" -> 60, etc.
		if (typeof value === 'string') {
			const num = parseInt(value.replace('d', ''), 10);
			if (num === 30 || num === 60 || num === 90) {
				return num as TrendsRange;
			}
		}
		// If already a number, return as-is
		if (typeof value === 'number' && (value === 30 || value === 60 || value === 90)) {
			return value as TrendsRange;
		}
		return value;
	})
	@Matches(/^(30|60|90)d?$/, {
		message: 'Range must be 30d, 60d, 90d, 30, 60, or 90',
	})
	range!: TrendsRange;

	@ApiPropertyOptional({
		description: 'Filter by route',
		example: '/v1/agents',
	})
	@IsOptional()
	@IsString()
	route?: string;

	@ApiPropertyOptional({
		description: 'Filter by HTTP method',
		enum: HttpMethod,
	})
	@IsOptional()
	@IsEnum(HttpMethod)
	method?: HttpMethod;
}

