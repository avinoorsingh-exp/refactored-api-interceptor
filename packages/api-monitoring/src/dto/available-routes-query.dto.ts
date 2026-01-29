import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for available routes and error codes query.
 * 
 * Returns all distinct routes and status codes available in api_route_stats
 * for the given time window. If no dates are provided, defaults to last 30 days.
 * 
 * @public
 */
export class AvailableRoutesQueryDto {
	@ApiPropertyOptional({
		description: 'Start date for the time window (ISO date string). Defaults to 30 days ago if not provided.',
		example: '2024-01-01T00:00:00Z',
		type: String,
	})
	@IsOptional()
	@IsDateString()
	@Transform(({ value }) => {
		// Ensure value is a string if provided
		if (value instanceof Date) {
			return value.toISOString();
		}
		return value;
	})
	startDate?: string;

	@ApiPropertyOptional({
		description: 'End date for the time window (ISO date string). Defaults to now if not provided.',
		example: '2024-01-31T23:59:59Z',
		type: String,
	})
	@IsOptional()
	@IsDateString()
	@Transform(({ value }) => {
		// Ensure value is a string if provided
		if (value instanceof Date) {
			return value.toISOString();
		}
		return value;
	})
	endDate?: string;
}

