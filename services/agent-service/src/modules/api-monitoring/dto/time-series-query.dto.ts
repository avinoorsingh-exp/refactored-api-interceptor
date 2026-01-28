import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
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
	startTime!: Date;

	@ApiProperty({
		description: 'End time for the query',
		example: '2024-01-02T00:00:00Z',
	})
	@IsDate()
	@Type(() => Date)
	endTime!: Date;

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

	@ApiPropertyOptional({
		description: 'Time bucket for aggregation',
		enum: TimeBucket,
		default: TimeBucket.HOUR,
	})
	@IsOptional()
	@IsEnum(TimeBucket)
	timeBucket?: TimeBucket = TimeBucket.HOUR;

	@ApiPropertyOptional({
		description: 'Filter by actor ID',
		format: 'uuid',
	})
	@IsOptional()
	@IsString()
	actorId?: string;
}


