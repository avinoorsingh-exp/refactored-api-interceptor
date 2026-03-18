import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminJobExecutionStatus } from '@exprealty/database';

/**
 * DTO for admin job execution response.
 */
export class AdminJobExecutionResponseDto {
	@ApiProperty({
		description: 'Execution ID (UUID)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id!: string;

	@ApiProperty({
		description: 'Job name',
		example: 'kafka-message-cleanup',
	})
	jobName!: string;

	@ApiProperty({
		description: 'Execution status',
		enum: AdminJobExecutionStatus,
		example: AdminJobExecutionStatus.SUCCESS,
	})
	status!: AdminJobExecutionStatus;

	@ApiProperty({
		description: 'Execution start timestamp',
		example: '2024-01-15T02:00:00.000Z',
	})
	startedAt!: Date;

	@ApiPropertyOptional({
		description: 'Execution finish timestamp',
		example: '2024-01-15T02:00:05.000Z',
		nullable: true,
	})
	finishedAt?: Date | null;

	@ApiPropertyOptional({
		description: 'Execution duration in milliseconds',
		example: 5000,
		nullable: true,
	})
	durationMs?: number | null;

	@ApiPropertyOptional({
		description: 'Error message if execution failed',
		example: 'Connection timeout',
		nullable: true,
	})
	error?: string | null;

	@ApiPropertyOptional({
		description: 'Execution log/output containing details of what the job did',
		example: '{"deletedCount": 1250, "cutoffDate": "2024-01-01T00:00:00.000Z"}',
		nullable: true,
	})
	log?: string | null;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2024-01-15T02:00:00.000Z',
	})
	createdAt!: Date;
}

