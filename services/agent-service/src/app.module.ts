// services/agent-service/src/app.module.ts
import { Module } from '@nestjs/common'
import { DatabaseModule } from './core/database.module.js'
import { ConfigModule } from './core/config.module.js'
import { LoggerModule } from './core/logger.module.js'
import { AgentController } from './app.controller.js'
import { CountriesModule } from './modules/countries/countries.module.js'
import { CompaniesModule } from './modules/companies/companies.module.js'
import { RegionsModule } from './modules/regions/regions.module.js'

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
export class AppModule {
	// NestJS modules must be classes, even if empty
}
