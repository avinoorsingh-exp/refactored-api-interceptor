import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { ConfigService } from './core/config.service.js'
import { LoggerService } from './core/logger.service.js'
import helmet from 'helmet';
import compression from 'compression';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	// Get services
	const configService = app.get(ConfigService)
	const config = configService.getAll()

	// Get LoggerService from DI container
	const logger = app.get(LoggerService)

	//Global middleware and settings
	app.use(
		helmet({
		contentSecurityPolicy: false,
		})
	);
	app.use(compression());

	// Enable CORS
	app.enableCors({
		origin: config.ALLOWED_ORIGINS.split(','),
		credentials: true,
	})

	app.useGlobalFilters(new ProblemDetailsFilter(logger))
	
	// NOTE: Global ValidationPipe removed in favor of Zod-first architecture
	// 
	// Previously used: app.useGlobalPipes(new ValidationPipe({ whitelist: true, ... }))
	// This required class-validator and class-transformer packages.
	//
	// Current approach: Use ZodValidationPipe on individual routes with schemas from @exprealty/shared-domain
	// Benefits:
	// - Single source of truth for validation (shared-domain package)
	// - Compile-time type safety (Zod inferred types)
	// - No duplicate validation logic between DTO decorators and domain schemas
	// - Smaller bundle size (no class-validator/class-transformer dependencies)
	//
	// Example:
	//   @Post()
	//   @UsePipes(new ZodValidationPipe(CreateCountryInputSchema))
	//   async create(@Body() dto: CreateCountryDto) { ... }
	//
	// For query parameters with type coercion:
	//   @Get()
	//   @UsePipes(new ZodValidationPipe(PaginationQuerySchema))
	//   async findAll(@Query() query: PaginationQuery) { ... }

	// Start server
	await app.listen(config.PORT)

	app.enableShutdownHooks()
}
void bootstrap()
