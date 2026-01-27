import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
		description: 'Maximum number of results to return',
		example: 50,
		minimum: 1,
		maximum: 200,
		default: 50,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(200)
	@Type(() => Number)
	limit?: number;
}

