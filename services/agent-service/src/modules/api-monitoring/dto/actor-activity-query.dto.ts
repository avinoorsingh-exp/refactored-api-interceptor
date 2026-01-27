import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for actor activity query.
 * @public
 */
export class ActorActivityQueryDto {
	@ApiProperty({
		description: 'Actor ID (UUID)',
		format: 'uuid',
	})
	@IsUUID()
	actorId!: string;

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

	@ApiProperty({
		description: 'Maximum number of results',
		default: 100,
		minimum: 1,
		maximum: 1000,
	})
	@IsInt()
	@Min(1)
	@Max(1000)
	limit: number = 100;
}

