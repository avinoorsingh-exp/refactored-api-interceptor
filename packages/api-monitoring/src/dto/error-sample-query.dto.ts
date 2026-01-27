import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiErrorClassification } from '@exprealty/shared-domain';
import { PaginationQueryDto } from './pagination-query.dto.js';

/**
 * DTO for error sample query.
 * 
 * Extends PaginationQueryDto for cursor-based pagination support.
 * All pagination fields are optional for backward compatibility.
 * 
 * @public
 */
export class ErrorSampleQueryDto extends PaginationQueryDto {
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

	/**
	 * Filter by HTTP status code.
	 * Used for filtering by severity (4xx vs 5xx).
	 */
	@ApiPropertyOptional({
		description: 'Filter by HTTP status code (e.g., 404, 500)',
		example: 500,
	})
	@IsOptional()
	@IsInt()
	@Type(() => Number)
	statusCode?: number;

	/**
	 * Legacy limit field (deprecated, use limit from PaginationQueryDto).
	 * Kept for backward compatibility.
	 * 
	 * @deprecated Use limit from PaginationQueryDto instead
	 */
	@ApiPropertyOptional({
		description: 'Maximum number of results (deprecated, use limit)',
		default: 50,
		minimum: 1,
		maximum: 100,
		deprecated: true,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	legacyLimit?: number;
}

