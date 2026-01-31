import { Global, Module } from '@nestjs/common';
import { ApiRequestContextService } from './services/api-request-context.service.js';

/**
 * API Monitoring Module
 * 
 * Provides request context management with actor attribution
 * for API monitoring and security purposes.
 * 
 * This module is global to ensure ApiRequestContextService
 * is available throughout the application.
 * 
 * @public
 */
@Global()
@Module({
	providers: [ApiRequestContextService],
	exports: [ApiRequestContextService],
})
export class ApiMonitoringModule {}

