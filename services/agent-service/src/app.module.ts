// services/agent-service/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { DatabaseModule } from './core/database.module.js'
import { ConfigModule } from './core/config.module.js'
import { LoggerModule } from './core/logger.module.js'
import { AgentController } from './app.controller.js'
import { CountriesModule } from './modules/countries/countries.module.js'
import { CompaniesModule } from './modules/companies/companies.module.js'
import { RegionsModule } from './modules/regions/regions.module.js'
import { CorrelationIdMiddleware } from './common/correlation-id.middleware.js'

@Module({
	imports: [
    LoggerModule,
    ConfigModule,
    DatabaseModule,
    CountriesModule,
    CompaniesModule,
    RegionsModule,
	],
	controllers: [AgentController],
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
