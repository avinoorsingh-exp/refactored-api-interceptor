// CRITICAL: Process-level error handlers MUST be registered FIRST, before any imports
// This ensures we catch ALL errors, including those during module initialization

// ============================================================================
// PROCESS-LEVEL ERROR HANDLERS (Registered BEFORE any other code)
// ============================================================================

console.error('[MAIN] Process starting - registering error handlers...')

// Trap uncaught exceptions
process.on('uncaughtException', (error: Error) => {
	console.error('[FATAL] Uncaught Exception:', error.message)
	console.error('[FATAL] Stack:', error.stack)
	console.error('[FATAL] Process will exit with code 1')
	process.exit(1)
})

// Trap unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
	const errorMessage = reason instanceof Error ? reason.message : String(reason)
	const errorStack = reason instanceof Error ? reason.stack : undefined
	console.error('[FATAL] Unhandled Promise Rejection:', errorMessage)
	if (errorStack) {
		console.error('[FATAL] Stack:', errorStack)
	}
	console.error('[FATAL] Process will exit with code 1')
	process.exit(1)
})

// Trap process exit
process.on('exit', (code: number) => {
	console.error(`[EXIT] Process exiting with code ${code}`)
	// Force flush stderr before exit
	process.stderr.write(`[EXIT] Process exiting with code ${code}\n`, () => {
		process.exit(code)
	})
})

// Trap beforeExit (fires when event loop is empty)
process.on('beforeExit', (code: number) => {
	console.error(`[BEFORE_EXIT] Process beforeExit event, code: ${code}`)
	// This should not happen if app is running correctly
	// If it does, something is wrong with the event loop
	setTimeout(() => {
		console.error('[BEFORE_EXIT] Event loop is empty - this should not happen if app is running')
		process.exit(1)
	}, 1000)
})

console.error('[MAIN] Error handlers registered successfully')

// ============================================================================
// IMPORTS (After error handlers are registered)
// ============================================================================

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

console.error('[MAIN] Imports loaded successfully')

// ============================================================================
// BOOTSTRAP FUNCTION
// ============================================================================

async function bootstrap() {
	try {
		console.error('[BOOTSTRAP] Starting bootstrap function...')
		
		// CRITICAL: Load configuration BEFORE creating NestJS app
		// This ensures AWS Secrets Manager secrets are loaded before any modules initialize
		console.error('[BOOTSTRAP] Step 1: Preloading configuration...')
		try {
			await configuration()
			console.error('[BOOTSTRAP] Step 1: Configuration preloaded successfully')
		} catch (configError) {
			console.error('[BOOTSTRAP] Step 1: Configuration preload FAILED:', configError)
			if (configError instanceof Error) {
				console.error('[BOOTSTRAP] Config error message:', configError.message)
				console.error('[BOOTSTRAP] Config error stack:', configError.stack)
			}
			throw configError
		}
		
		console.error('[BOOTSTRAP] Step 2: Creating NestJS application...')
		let app
		try {
			app = await NestFactory.create(AppModule)
			console.error('[BOOTSTRAP] Step 2: NestJS application created successfully')
		} catch (nestError) {
			console.error('[BOOTSTRAP] Step 2: NestJS application creation FAILED:', nestError)
			if (nestError instanceof Error) {
				console.error('[BOOTSTRAP] Nest error message:', nestError.message)
				console.error('[BOOTSTRAP] Nest error stack:', nestError.stack)
			}
			throw nestError
		}

		console.error('[BOOTSTRAP] Step 3: Getting services from DI container...')
		let configService: ConfigService
		let config: any
		let dataSource: DataSource
		let logger: LoggerService
		
		try {
			configService = app.get(ConfigService)
			config = configService.getAll()
			dataSource = app.get(DataSource)
			logger = app.get(LoggerService)
			console.error('[BOOTSTRAP] Step 3: Services retrieved successfully')
		} catch (serviceError) {
			console.error('[BOOTSTRAP] Step 3: Service retrieval FAILED:', serviceError)
			if (serviceError instanceof Error) {
				console.error('[BOOTSTRAP] Service error message:', serviceError.message)
				console.error('[BOOTSTRAP] Service error stack:', serviceError.stack)
			}
			throw serviceError
		}

		console.error('[BOOTSTRAP] Step 4: Configuring middleware...')
		try {
			//Global middleware and settings
			app.use(
				helmet({
					contentSecurityPolicy: false,
				})
			);
			
			// Configure compression middleware
			app.use(compression({
				threshold: 1024,
				filter: (req, res) => {
					if (req.headers['x-no-compression']) {
						return false;
					}
					return compression.filter(req, res);
				},
			}));
			
			// Middleware to fix conflicting Content-Length and Transfer-Encoding headers
			app.use((req: any, res: any, next: any) => {
				const originalWrite = res.write.bind(res);
				const originalEnd = res.end.bind(res);
				
				const fixHeaders = () => {
					const transferEncoding = res.getHeader('transfer-encoding');
					const contentLength = res.getHeader('content-length');
					
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
			
			console.error('[BOOTSTRAP] Step 4: Middleware configured successfully')
		} catch (middlewareError) {
			console.error('[BOOTSTRAP] Step 4: Middleware configuration FAILED:', middlewareError)
			if (middlewareError instanceof Error) {
				console.error('[BOOTSTRAP] Middleware error message:', middlewareError.message)
				console.error('[BOOTSTRAP] Middleware error stack:', middlewareError.stack)
			}
			throw middlewareError
		}

		console.error('[BOOTSTRAP] Step 5: Enabling CORS...')
		try {
			app.enableCors({
				origin: config.ALLOWED_ORIGINS.split(','),
				credentials: true,
			})
			console.error('[BOOTSTRAP] Step 5: CORS enabled successfully')
		} catch (corsError) {
			console.error('[BOOTSTRAP] Step 5: CORS configuration FAILED:', corsError)
			if (corsError instanceof Error) {
				console.error('[BOOTSTRAP] CORS error message:', corsError.message)
				console.error('[BOOTSTRAP] CORS error stack:', corsError.stack)
			}
			throw corsError
		}

		console.error('[BOOTSTRAP] Step 6: Configuring interceptors...')
		try {
			const environment = configService.get('NODE_ENV')
			const includeQueryMetadata = environment === 'local' || environment === 'dev'

			if (includeQueryMetadata) {
				app.useGlobalInterceptors(
					new QueryPerformanceInterceptor(dataSource, {
						slowQueryThresholdMs: 2000,
						criticalQueryThresholdMs: 10000,
						logAllQueries: false,
						captureExplain: true,
						includeInResponse: includeQueryMetadata,
					}),
				)
				logger.info(`Query metadata enabled for environment: ${environment}`)
			} else {
				app.useGlobalInterceptors(
					new PerformanceInterceptor({
						slowQueryThresholdMs: 2000,
						includeInBody: false,
						logAllQueries: false,
					}),
				)
				logger.info(`Performance-only interceptor enabled for environment: ${environment}`)
			}
			console.error('[BOOTSTRAP] Step 6: Interceptors configured successfully')
		} catch (interceptorError) {
			console.error('[BOOTSTRAP] Step 6: Interceptor configuration FAILED:', interceptorError)
			if (interceptorError instanceof Error) {
				console.error('[BOOTSTRAP] Interceptor error message:', interceptorError.message)
				console.error('[BOOTSTRAP] Interceptor error stack:', interceptorError.stack)
			}
			throw interceptorError
		}

		console.error('[BOOTSTRAP] Step 7: Registering exception filter...')
		try {
			app.useGlobalFilters(new ProblemDetailsFilter(logger))
			console.error('[BOOTSTRAP] Step 7: Exception filter registered successfully')
		} catch (filterError) {
			console.error('[BOOTSTRAP] Step 7: Exception filter registration FAILED:', filterError)
			if (filterError instanceof Error) {
				console.error('[BOOTSTRAP] Filter error message:', filterError.message)
				console.error('[BOOTSTRAP] Filter error stack:', filterError.stack)
			}
			throw filterError
		}

		console.error('[BOOTSTRAP] Step 8: Setting up Swagger...')
		try {
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
			console.error('[BOOTSTRAP] Step 8: Swagger setup completed successfully')
		} catch (swaggerError) {
			console.error('[BOOTSTRAP] Step 8: Swagger setup FAILED:', swaggerError)
			if (swaggerError instanceof Error) {
				console.error('[BOOTSTRAP] Swagger error message:', swaggerError.message)
				console.error('[BOOTSTRAP] Swagger error stack:', swaggerError.stack)
			}
			throw swaggerError
		}

		console.error('[BOOTSTRAP] Step 9: Starting HTTP server...')
		try {
			await app.listen(config.PORT)
			console.error(`[BOOTSTRAP] Step 9: HTTP server started successfully on port ${config.PORT}`)
			logger.info(`Agent service listening on port ${config.PORT}`, {
				port: config.PORT,
				environment: config.NODE_ENV,
			})
		} catch (listenError) {
			console.error('[BOOTSTRAP] Step 9: HTTP server startup FAILED:', listenError)
			if (listenError instanceof Error) {
				console.error('[BOOTSTRAP] Listen error message:', listenError.message)
				console.error('[BOOTSTRAP] Listen error stack:', listenError.stack)
			}
			throw listenError
		}

		console.error('[BOOTSTRAP] Step 10: Enabling shutdown hooks...')
		try {
			app.enableShutdownHooks()
			console.error('[BOOTSTRAP] Step 10: Shutdown hooks enabled successfully')
		} catch (shutdownError) {
			console.error('[BOOTSTRAP] Step 10: Shutdown hooks FAILED:', shutdownError)
			if (shutdownError instanceof Error) {
				console.error('[BOOTSTRAP] Shutdown error message:', shutdownError.message)
				console.error('[BOOTSTRAP] Shutdown error stack:', shutdownError.stack)
			}
			// Don't throw - shutdown hooks are optional
		}

		console.error('[BOOTSTRAP] Bootstrap completed successfully - application is running')
		
		// Register signal handlers (but don't let them cause silent exits)
		process.on('SIGTERM', () => {
			console.error('[SIGTERM] Signal received, initiating graceful shutdown...')
			logger.info('SIGTERM received, initiating graceful shutdown...')
			app.close().then(() => {
				console.error('[SIGTERM] Application closed gracefully')
				logger.info('Application closed gracefully')
				process.exit(0)
			}).catch((error) => {
				console.error('[SIGTERM] Error during graceful shutdown:', error)
				logger.error('Error during graceful shutdown', {
					error: error instanceof Error ? error.message : String(error),
				})
				process.exit(1)
			})
		})

		process.on('SIGINT', () => {
			console.error('[SIGINT] Signal received, initiating graceful shutdown...')
			logger.info('SIGINT received, initiating graceful shutdown...')
			app.close().then(() => {
				console.error('[SIGINT] Application closed gracefully')
				logger.info('Application closed gracefully')
				process.exit(0)
			}).catch((error) => {
				console.error('[SIGINT] Error during graceful shutdown:', error)
				logger.error('Error during graceful shutdown', {
					error: error instanceof Error ? error.message : String(error),
				})
				process.exit(1)
			})
		})

	} catch (bootstrapError) {
		console.error('[BOOTSTRAP] Bootstrap function FAILED with error:', bootstrapError)
		if (bootstrapError instanceof Error) {
			console.error('[BOOTSTRAP] Bootstrap error message:', bootstrapError.message)
			console.error('[BOOTSTRAP] Bootstrap error stack:', bootstrapError.stack)
		}
		throw bootstrapError
	}
}

// ============================================================================
// ENTRY POINT
// ============================================================================

console.error('[MAIN] Calling bootstrap()...')

// Ensure bootstrap doesn't exit silently
const bootstrapPromise = bootstrap().catch((error) => {
	console.error('[MAIN] Bootstrap promise rejected:', error)
	if (error instanceof Error) {
		console.error('[MAIN] Error message:', error.message)
		console.error('[MAIN] Error stack:', error.stack)
	} else {
		console.error('[MAIN] Error (non-Error object):', JSON.stringify(error, null, 2))
	}
	console.error('[MAIN] Process will exit with code 1')
	
	// Force flush stderr before exit
	process.stderr.write(`[MAIN] Fatal error during bootstrap - exiting\n`, () => {
		process.exit(1)
	})
})

console.error('[MAIN] Bootstrap promise created, waiting for async execution...')

// Keep process alive - prevent silent exit
// This ensures the process doesn't exit if bootstrap completes but something else fails
setTimeout(() => {
	console.error('[MAIN] Process still alive after 5 seconds - checking bootstrap status...')
	bootstrapPromise.then(() => {
		console.error('[MAIN] Bootstrap completed successfully')
	}).catch(() => {
		console.error('[MAIN] Bootstrap failed (error already logged above)')
	})
}, 5000)
