// services/agent-service/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DatabaseModule } from './core/database.module.js'
import { ConfigModule } from './core/config.module.js'
import { LoggerModule } from './core/logger.module.js'
import { QueryModule } from './common/query/query.module.js'
import { MetadataModule } from './modules/metadata/metadata.module.js'
import { AgentController, RootHealthController } from './app.controller.js'
import { CountriesModule } from './modules/countries/countries.module.js'
import { CompaniesModule } from './modules/companies/companies.module.js'
import { RegionsModule } from './modules/regions/regions.module.js'
import { StatesModule } from './modules/states/states.module.js'
import { PayPlansModule } from './modules/pay-plans/pay-plans.module.js'
import { OfficesModule } from './modules/offices/offices.module.js'
import { MLSModule } from './modules/mls/mls.module.js'
import { AgentModule } from './modules/agents/agent.module.js'
import { KafkaModule } from './modules/kafka/kafka.module.js'
import { AdminJobsModule } from './modules/admin/jobs/admin-jobs.module.js'
import { ApiMonitoringModule, ApiActorMiddleware, API_MONITORING_LOGGER_TOKEN } from '@exprealty/api-monitoring'
import { CorrelationIdMiddleware } from './common/correlation-id.middleware.js'
import { LoggerService } from './core/logger.service.js'

@Module({
	imports: [
    LoggerModule,  // Must be first so LoggerService is available
    ConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(), // Enable scheduled tasks
    QueryModule,  // Global module - provides QueryService and search strategies
    MetadataModule,  // Global module - provides MetadataService for entity metadata
    CountriesModule,
    CompaniesModule,
    RegionsModule,
    StatesModule,
    PayPlansModule,
    OfficesModule,
    MLSModule,
    AgentModule,
    KafkaModule,
    AdminJobsModule,
    ApiMonitoringModule.forRoot({
      logger: LoggerService, // LoggerService class from LoggerModule (which is @Global())
    }),
	],
	controllers: [AgentController, RootHealthController],
	providers: [
		// CRITICAL: Provide API_MONITORING_LOGGER_TOKEN in AppModule context
		// 
		// WHY THIS IS NEEDED:
		// - ApiActorMiddleware is registered in AppModule.configure() via consumer.apply()
		// - When app.listen() is called, NestJS resolves middleware dependencies
		// - Middleware resolution looks for tokens in the SAME module context where
		//   the middleware is registered (AppModule), not in the module where it's defined
		// - Even though ApiMonitoringModule is @Global(), middleware registered via
		//   MiddlewareConsumer requires tokens to be available in the registering module
		// - useExisting references LoggerService from @Global() LoggerModule, which
		//   is available app-wide, so this will resolve correctly
		//
		// This ensures the token is available when NestJS resolves ApiActorMiddleware
		// dependencies during HTTP server startup (app.listen()).
		{
			provide: API_MONITORING_LOGGER_TOKEN,
			useExisting: LoggerService,
		},
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// Apply correlation ID middleware to all routes (must be first)
		consumer
			.apply(CorrelationIdMiddleware)
			.forRoutes('*')

		// Apply API actor middleware after correlation ID (needs correlation context)
		// This runs after authentication middleware to attribute requests to actors
		// Note: ApiActorMiddleware is injected via NestJS DI when applied
		consumer
			.apply(ApiActorMiddleware)
			.forRoutes('*')
	}
}
