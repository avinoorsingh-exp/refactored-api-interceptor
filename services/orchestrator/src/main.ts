// services/orchestrator/src/main.ts
// services/orchestrator/src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { ProblemDetailsFilter } from './common/problem-details.filter.js'
import { LoggerService } from './core/logger.service.js'
import { ConfigService } from './core/config.service.js'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	// Get services from DI container
	const logger = app.get(LoggerService)
	const configService = app.get(ConfigService)
	const config = configService.getAll()

	// Enable CORS
	app.enableCors({
		origin: config.ALLOWED_ORIGINS === '*' 
			? '*' 
			: config.ALLOWED_ORIGINS?.split(',') || '*',
		credentials: true,
	})

	// Register global exception filter for RFC 9457 Problem Details.
	app.useGlobalFilters(new ProblemDetailsFilter(logger))

	app.enableShutdownHooks()
	await app.listen(config.PORT || (process.env.PORT ? Number(process.env.PORT) : 8081))
}
void bootstrap()
