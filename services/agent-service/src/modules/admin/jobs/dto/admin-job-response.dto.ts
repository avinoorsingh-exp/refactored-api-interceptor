import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for admin job response.
 */
export class AdminJobResponseDto {
	@ApiProperty({
		description: 'Job name (unique identifier)',
		example: 'kafka-message-cleanup',
	})
	name!: string;

	@ApiProperty({
		description: 'Job description',
		example: 'Cleans up old Kafka message processing records',
	})
	description!: string;

	@ApiPropertyOptional({
		description: 'Cron expression for scheduling. Null for manual-only jobs.',
		example: '0 2 * * *',
		nullable: true,
	})
	cronExpression?: string | null;

	@ApiProperty({
		description: 'Whether the job is enabled',
		example: true,
	})
	enabled!: boolean;

	@ApiProperty({
		description: 'If true, job will run once automatically on app startup (if not already run).',
		example: false,
	})
	runOnStartup!: boolean;

	@ApiPropertyOptional({
		description: 'Timestamp of last execution',
		example: '2024-01-15T02:00:00.000Z',
		nullable: true,
	})
	lastRunAt?: Date | null;

	@ApiPropertyOptional({
		description: 'Timestamp of next scheduled execution',
		example: '2024-01-16T02:00:00.000Z',
		nullable: true,
	})
	nextRunAt?: Date | null;

	@ApiProperty({
		description: 'Total number of executions',
		example: 365,
	})
	runCount!: number;

	@ApiProperty({
		description: 'Total number of failed executions',
		example: 2,
	})
	failureCount!: number;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2024-01-01T00:00:00.000Z',
	})
	createdAt!: Date;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2024-01-15T02:00:00.000Z',
	})
	updatedAt!: Date;
}

