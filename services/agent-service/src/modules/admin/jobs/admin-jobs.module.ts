import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminJobEntity, AdminJobExecutionEntity } from '@exprealty/database';
import { AdminJobService } from './admin-job.service.js';
import { AdminJobsController } from './admin-jobs.controller.js';
import { KafkaMessageCleanupJobHandler } from './handlers/kafka-message-cleanup-job-handler.js';
import { ApiRouteStatsAggregationJobHandler } from './handlers/api-route-stats-aggregation-job-handler.js';
import { JobLogCaptureService } from './job-log-capture.service.js';
import { KafkaModule } from '../../kafka/kafka.module.js';

/**
 * Admin Jobs Module
 * 
 * Provides management and monitoring for scheduled jobs.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([AdminJobEntity, AdminJobExecutionEntity]),
		ScheduleModule,
		KafkaModule,
		// ApiMonitoringModule is @Global() and already imported in AppModule,
		// so ApiMetricsService is available without explicit import
	],
	providers: [
		AdminJobService,
		JobLogCaptureService,
		KafkaMessageCleanupJobHandler,
		ApiRouteStatsAggregationJobHandler,
	],
	controllers: [AdminJobsController],
	exports: [AdminJobService],
})
export class AdminJobsModule {}

