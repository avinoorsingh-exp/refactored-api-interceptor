import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiErrorClassification } from '@exprealty/shared-domain';

/**
 * DTO for error sample query.
 * @public
 */
export class ErrorSampleQueryDto {
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
		description: 'Filter by error classification',
		enum: ApiErrorClassification,
	})
	@IsOptional()
	@IsEnum(ApiErrorClassification)
	classification?: ApiErrorClassification;

	@ApiPropertyOptional({
		description: 'Filter by route',
		example: '/v1/agents',
	})
	@IsOptional()
	@IsString()
	route?: string;

	@ApiProperty({
		description: 'Maximum number of results',
		default: 50,
		minimum: 1,
		maximum: 100,
	})
	@IsInt()
	@Min(1)
	@Max(100)
	limit: number = 50;
}


