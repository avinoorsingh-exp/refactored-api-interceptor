import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { ConfigService } from './core/config.service.js'
import { LoggerService } from './core/logger.service.js'
import helmet from 'helmet'
import compression from 'compression'
import { ProblemDetailsFilter } from './common/problem-details.filter.js'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import configuration from './core/configuration.js'
import { QueryPerformanceInterceptor } from './common/interceptors/query-performance.interceptor.js'
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor.js'
import { DataSource } from 'typeorm'

async function bootstrap() {
	// CRITICAL: Load configuration BEFORE creating NestJS app
	// This ensures AWS Secrets Manager secrets are loaded before any modules initialize
	console.log('[Bootstrap] Preloading configuration...')
	await configuration()
	console.log('[Bootstrap] Configuration preloaded successfully')
	
	const app = await NestFactory.create(AppModule)

	// Get services
	const configService = app.get(ConfigService)
	const config = configService.getAll()

	// Get dependencies from DI container
  	const dataSource = app.get(DataSource);
	// Get LoggerService from DI container
	const logger = app.get(LoggerService)

	//Global middleware and settings
	app.use(
		helmet({
		contentSecurityPolicy: false,
		})
	);
	
	// Configure compression middleware
	// The filter ensures compression only applies when appropriate
	app.use(compression({
		// Only compress responses above 1KB (default is 1KB, being explicit)
		threshold: 1024,
		// Filter function to decide if response should be compressed
		filter: (req, res) => {
			// Don't compress if client doesn't accept encoding
			if (req.headers['x-no-compression']) {
				return false;
			}
			// Use compression's default filter for MIME types
			return compression.filter(req, res);
		},
	}));
	
	// Middleware to fix conflicting Content-Length and Transfer-Encoding headers
	// HTTP spec: Cannot have both Content-Length and Transfer-Encoding: chunked
	// This ensures only one is present before response is sent
	app.use((req: any, res: any, next: any) => {
		const originalWrite = res.write.bind(res);
		const originalEnd = res.end.bind(res);
		
		const fixHeaders = () => {
			const transferEncoding = res.getHeader('transfer-encoding');
			const contentLength = res.getHeader('content-length');
			
			// If both headers are set, remove Content-Length (Transfer-Encoding takes precedence)
			if (transferEncoding && contentLength) {
				res.removeHeader('content-length');
			}
		};
		
		res.write = function(...args: any[]) {
			fixHeaders();
			return originalWrite(...args);
		};
		
		res.end = function(...args: any[]) {
			fixHeaders();
			return originalEnd(...args);
		};
		
		next();
	});

	// Enable CORS
	app.enableCors({
		origin: config.ALLOWED_ORIGINS.split(','),
		credentials: true,
	})

	// Configure interceptors based on environment
	// Use ConfigService for environment detection (NODE_ENV: 'local', 'dev', 'staging', 'prod')
	const environment = configService.get('NODE_ENV')
	const includeQueryMetadata = environment === 'local' || environment === 'dev'

	if (includeQueryMetadata) {
		// Local/Dev: Include full query metadata in response for debugging
		app.useGlobalInterceptors(
			new QueryPerformanceInterceptor(dataSource, {
				slowQueryThresholdMs: 2000,      // Log queries > 2 seconds
				criticalQueryThresholdMs: 10000, // Error log queries > 10 seconds
				logAllQueries: false,            // Only log slow queries in prod
				captureExplain: true,            // Run EXPLAIN ANALYZE on slow queries
				includeInResponse: includeQueryMetadata, // Include SQL in dev
}),
		)
		logger.info(`Query metadata enabled for environment: ${environment}`)
	} else {
		// Staging/Production: Only performance headers, no body metadata
		app.useGlobalInterceptors(
			new PerformanceInterceptor({
				slowQueryThresholdMs: 2000,
				includeInBody: false,
				logAllQueries: false,
			}),
		)
		logger.info(`Performance-only interceptor enabled for environment: ${environment}`)
	}

	// Register global exception filter (handles all exceptions including database errors)
	app.useGlobalFilters(new ProblemDetailsFilter(logger))

	// Setup Swagger/OpenAPI documentation
	const swaggerConfig = new DocumentBuilder()
		.setTitle('Agent Service API')
		.setDescription('REST API for managing agents, companies, regions, and related entities')
		.setVersion('1.0')
		.addTag('countries', 'Country management endpoints')
		.addTag('companies', 'Company management endpoints')
		.addTag('regions', 'Region management endpoints')
		.build()

	const document = SwaggerModule.createDocument(app, swaggerConfig)
	SwaggerModule.setup('api', app, document)
	
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
