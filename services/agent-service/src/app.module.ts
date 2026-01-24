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
import { CorrelationIdMiddleware } from './common/correlation-id.middleware.js'

@Module({
	imports: [
    LoggerModule,
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
	],
	controllers: [AgentController, RootHealthController],
	providers: [],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// Apply correlation ID middleware to all routes
		consumer
			.apply(CorrelationIdMiddleware)
			.forRoutes('*')
	}
}
