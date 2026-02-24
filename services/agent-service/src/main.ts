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
import { ResponseHeaderFixInterceptor } from './common/interceptors/response-header-fix.interceptor.js'
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
			
			// CRITICAL: Response header normalization middleware
			// Prevents invalid HTTP responses with both Content-Length and Transfer-Encoding
			// This must run after compression middleware but before headers are committed
			app.use((req: any, res: any, next: any) => {
				// Track Transfer-Encoding state
				let hasTransferEncoding = false;
				
				// Store original methods
				const originalSetHeader = res.setHeader.bind(res);
				const originalWriteHead = res.writeHead.bind(res);
				const originalEnd = res.end.bind(res);
				
				// Normalize headers by removing Content-Length when Transfer-Encoding is present
				const normalizeHeaders = () => {
					if (res.headersSent || res.finished) {
						return;
					}
					
					// Check current state
					const transferEncoding = res.getHeader('transfer-encoding');
					const contentLength = res.getHeader('content-length');
					
					if (transferEncoding) {
						hasTransferEncoding = true;
						// Transfer-Encoding takes precedence - remove Content-Length
						if (contentLength) {
							try {
								res.removeHeader('content-length');
								// Clean up internal header storage
								if ((res as any)._headers) {
									delete (res as any)._headers['content-length'];
									delete (res as any)._headers['Content-Length'];
								}
								if ((res as any)._headerNames) {
									delete (res as any)._headerNames['content-length'];
									delete (res as any)._headerNames['Content-Length'];
								}
								if ((res as any)._removedHeader) {
									(res as any)._removedHeader['content-length'] = true;
									(res as any)._removedHeader['Content-Length'] = true;
								}
							} catch (e) {
								// Ignore errors if headers are already sent
							}
						}
					}
				};
				
				// Intercept setHeader to prevent Content-Length when Transfer-Encoding is present
				res.setHeader = function(name: string, value: any) {
					const lowerName = name.toLowerCase();
					
					if (lowerName === 'transfer-encoding') {
						hasTransferEncoding = true;
						// Remove Content-Length if it exists
						if (res.getHeader('content-length')) {
							res.removeHeader('content-length');
							if ((res as any)._headers) {
								delete (res as any)._headers['content-length'];
								delete (res as any)._headers['Content-Length'];
							}
						}
					} else if (lowerName === 'content-length' && hasTransferEncoding) {
						// Transfer-Encoding takes precedence - don't set Content-Length
						return res;
					}
					
					return originalSetHeader(name, value);
				};
				
				// Intercept writeHead - this is where headers are committed
				// CRITICAL: Normalize headers right before they're sent
				// Express writeHead has multiple signatures:
				// - writeHead(statusCode)
				// - writeHead(statusCode, headers)
				// - writeHead(statusCode, statusMessage, headers)
				res.writeHead = function(statusCode: number, statusMessageOrHeaders?: any, headers?: any) {
					// Normalize headers before committing
					normalizeHeaders();
					
					// Determine which signature was used
					let actualHeaders: any = undefined;
					let actualStatusMessage: string | undefined = undefined;
					
					if (arguments.length === 1) {
						// writeHead(statusCode)
						actualHeaders = undefined;
					} else if (arguments.length === 2) {
						// Could be writeHead(statusCode, headers) or writeHead(statusCode, statusMessage)
						if (typeof statusMessageOrHeaders === 'string') {
							// writeHead(statusCode, statusMessage)
							actualStatusMessage = statusMessageOrHeaders;
							actualHeaders = headers;
						} else {
							// writeHead(statusCode, headers)
							actualHeaders = statusMessageOrHeaders;
						}
					} else {
						// writeHead(statusCode, statusMessage, headers)
						actualStatusMessage = statusMessageOrHeaders;
						actualHeaders = headers;
					}
					
					// Clean up headers object if provided
					if (actualHeaders && typeof actualHeaders === 'object' && !Array.isArray(actualHeaders)) {
						const transferEncoding = actualHeaders['transfer-encoding'] || actualHeaders['Transfer-Encoding'] || res.getHeader('transfer-encoding');
						if (transferEncoding) {
							delete actualHeaders['content-length'];
							delete actualHeaders['Content-Length'];
						}
					}
					
					// Call original writeHead with normalized arguments
					if (actualStatusMessage !== undefined) {
						return originalWriteHead(statusCode, actualStatusMessage, actualHeaders);
					} else if (actualHeaders !== undefined) {
						return originalWriteHead(statusCode, actualHeaders);
					} else {
						return originalWriteHead(statusCode);
					}
				};
				
				// Intercept end to normalize headers one final time
				res.end = function(...args: any[]) {
					// CRITICAL: Normalize headers right before sending response
					normalizeHeaders();
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
			const perfQueryMode = configService.get('PERF_QUERY_MODE') || (environment === 'local' ? 'query' : 'off')
			const slowMs = configService.get('PERF_QUERY_SLOW_MS') || 2000
			const criticalMs = configService.get('PERF_QUERY_CRITICAL_MS') || 10000
			const logAll = configService.get('PERF_QUERY_LOG_ALL') || false
			const includeInResponse = configService.get('PERF_QUERY_INCLUDE_IN_RESPONSE') || false
			const captureExplain = configService.get('PERF_QUERY_CAPTURE_EXPLAIN') || 'slow'
			const sampleRate = configService.get('PERF_QUERY_SAMPLE_RATE') ?? (environment === 'local' ? 1.0 : 0.01)
			const allowlistRaw = configService.get('PERF_QUERY_ENDPOINT_ALLOWLIST') || ''
			const endpointAllowlist = allowlistRaw ? allowlistRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : []

			// CRITICAL: ResponseHeaderFixInterceptor must run LAST to fix headers after all other interceptors
			// This ensures Content-Length is removed when Transfer-Encoding is present
			const headerFixInterceptor = new ResponseHeaderFixInterceptor();

			if (perfQueryMode === 'query') {
				app.useGlobalInterceptors(
					new QueryPerformanceInterceptor(dataSource, {
						slowQueryThresholdMs: slowMs,
						criticalQueryThresholdMs: criticalMs,
						logAllQueries: logAll,
						captureExplain,
						includeInResponse,
						sampleRate,
						endpointAllowlist,
					}),
					headerFixInterceptor,
				)
				logger.info(`[Microscope] QueryPerformanceInterceptor active — mode=query, sampleRate=${sampleRate}, explain=${captureExplain}, slow=${slowMs}ms, critical=${criticalMs}ms, allowlist=${endpointAllowlist.length > 0 ? endpointAllowlist.join(',') : 'all'}`)
			} else if (perfQueryMode === 'perf') {
				app.useGlobalInterceptors(
					new PerformanceInterceptor({
						slowQueryThresholdMs: slowMs,
						includeInBody: includeInResponse,
						logAllQueries: logAll,
					}),
					headerFixInterceptor,
				)
				logger.info(`[Microscope] PerformanceInterceptor active — mode=perf, slow=${slowMs}ms, logAll=${logAll}`)
			} else {
				// mode === 'off': only header fix, no performance logging
				app.useGlobalInterceptors(
					headerFixInterceptor,
				)
				logger.info(`[Microscope] Performance interceptors disabled — mode=off`)
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
				.addBearerAuth()
				.addTag('countries', 'Country management endpoints')
				.addTag('companies', 'Company management endpoints')
				.addTag('regions', 'Region management endpoints')
				.build()

			// Apply bearer auth globally to all routes in the Swagger spec
			// Health controllers are excluded via @ApiExcludeController()
			const document = SwaggerModule.createDocument(app, swaggerConfig)
			document.security = [{ bearer: [] }]

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

		console.error('[BOOTSTRAP] Step 9: Asserting local development actor cardinality...')
		try {
			// HARD STOP: In local development (NODE_ENV === 'local'), assert that exactly ONE actor exists
			// If count > 1, CRASH THE APP - this is a correctness violation
			// CRITICAL: Only runs when NODE_ENV === 'local' - NEVER in AWS dev/test/prod
			// Use DataSource directly to avoid DI context issues
			const isLocal = process.env.NODE_ENV === 'local'
			if (isLocal) {
				const { ApiActorEntity } = await import('@exprealty/database')
				const actorRepo = dataSource.getRepository(ApiActorEntity)
				
				// Step 1: Cleanup - deactivate all actors except LOCAL_DOCKER_ACTOR
				const allActors = await actorRepo.find({
					where: { active: true },
				})
				
				const localDockerActor = allActors.find(
					(a) => a.identifier === 'LOCAL_DOCKER_ACTOR' && a.type === 'system',
				)
				
				if (localDockerActor) {
					// Deactivate all other actors
					const otherActors = allActors.filter((a) => a.id !== localDockerActor.id)
					if (otherActors.length > 0) {
						const otherActorIds = otherActors.map((a) => a.id)
						await actorRepo
							.createQueryBuilder()
							.update(ApiActorEntity)
							.set({ active: false })
							.where('id IN (:...ids)', { ids: otherActorIds })
							.execute()
						logger.info('Deactivated old actors in local development', {
							deactivatedCount: otherActors.length,
							keptActorId: localDockerActor.id,
						})
					}
				} else {
					// No LOCAL_DOCKER_ACTOR exists - deactivate all and one will be created on first request
					if (allActors.length > 0) {
						const allActorIds = allActors.map((a) => a.id)
						await actorRepo
							.createQueryBuilder()
							.update(ApiActorEntity)
							.set({ active: false })
							.where('id IN (:...ids)', { ids: allActorIds })
							.execute()
						logger.info('Deactivated all existing actors in local development - LOCAL_DOCKER_ACTOR will be created on first request', {
							deactivatedCount: allActors.length,
						})
					}
				}
				
				// Step 2: Assert that exactly ONE active actor exists (or zero, which is fine - will be created)
				const activeActors = await actorRepo.find({
					where: { active: true },
				})

				if (activeActors.length > 1) {
					const actorIds = activeActors.map((a) => ({
						id: a.id,
						type: a.type,
						identifier: a.identifier,
						displayName: a.displayName,
					}))

					const errorMessage = `ACTOR CARDINALITY VIOLATION IN LOCAL DEVELOPMENT: After cleanup, found ${activeActors.length} active actors, but only 1 is allowed. Actor IDs: ${JSON.stringify(actorIds, null, 2)}`
					logger.error(errorMessage, { actorCount: activeActors.length, actors: actorIds })
					throw new Error(errorMessage)
				}

				logger.info('Local development actor cardinality check passed', {
					actorCount: activeActors.length,
				})
			}
			console.error('[BOOTSTRAP] Step 9: Actor cardinality check passed')
		} catch (assertionError) {
			console.error('[BOOTSTRAP] Step 9: Actor cardinality assertion FAILED:', assertionError)
			if (assertionError instanceof Error) {
				console.error('[BOOTSTRAP] Assertion error message:', assertionError.message)
				console.error('[BOOTSTRAP] Assertion error stack:', assertionError.stack)
			}
			// CRASH THE APP - this is intentional
			throw assertionError
		}

		console.error('[BOOTSTRAP] Step 10: Starting HTTP server...')
		try {
			await app.listen(config.PORT)
			console.error(`[BOOTSTRAP] Step 10: HTTP server started successfully on port ${config.PORT}`)
			logger.info(`Agent service listening on port ${config.PORT}`, {
				port: config.PORT,
				environment: config.NODE_ENV,
			})
		} catch (listenError) {
			console.error('[BOOTSTRAP] Step 10: HTTP server startup FAILED:', listenError)
			if (listenError instanceof Error) {
				console.error('[BOOTSTRAP] Listen error message:', listenError.message)
				console.error('[BOOTSTRAP] Listen error stack:', listenError.stack)
			}
			throw listenError
		}

		console.error('[BOOTSTRAP] Step 11: Enabling shutdown hooks...')
		try {
			app.enableShutdownHooks()
			console.error('[BOOTSTRAP] Step 11: Shutdown hooks enabled successfully')
		} catch (shutdownError) {
			console.error('[BOOTSTRAP] Step 11: Shutdown hooks FAILED:', shutdownError)
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
