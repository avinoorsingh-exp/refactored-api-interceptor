import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from './pagination-query.dto.js';

/**
 * DTO for actor activity query.
 * 
 * Extends PaginationQueryDto for cursor-based pagination support.
 * All pagination fields are optional for backward compatibility.
 * 
 * @public
 */
export class ActorActivityQueryDto extends PaginationQueryDto {
	@ApiProperty({
		description: 'Actor ID (UUID)',
		format: 'uuid',
	})
	@IsUUID()
	actorId!: string;

	@ApiPropertyOptional({
		description: 'Start time for the query',
		example: '2024-01-01T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	startTime?: Date;

	@ApiPropertyOptional({
		description: 'End time for the query',
		example: '2024-01-02T00:00:00Z',
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	endTime?: Date;

	/**
	 * Legacy limit field (deprecated, use limit from PaginationQueryDto).
	 * Kept for backward compatibility.
	 * 
	 * @deprecated Use limit from PaginationQueryDto instead
	 */
	@ApiPropertyOptional({
		description: 'Maximum number of results (deprecated, use limit)',
		default: 100,
		minimum: 1,
		maximum: 1000,
		deprecated: true,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(1000)
	@Type(() => Number)
	legacyLimit?: number;
}

