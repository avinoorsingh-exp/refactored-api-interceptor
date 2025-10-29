// services/orchestrator/src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { ProblemDetailsFilter } from './common/problem-details.filter.js'
import { LoggerService } from './core/logger.service.js'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	// Get LoggerService from DI container
	const logger = app.get(LoggerService)

	// Register global exception filter for RFC 9457 Problem Details
	app.useGlobalFilters(new ProblemDetailsFilter(logger))

	app.enableShutdownHooks()
	await app.listen(process.env.PORT ? Number(process.env.PORT) : 8081)
}
void bootstrap()
