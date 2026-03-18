import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { CorrelationIdHelper, CORRELATION_ID_HEADER, AsyncContextStorage, RequestContext } from '@exprealty/cache'

/**
 * HTTP Middleware to extract/generate correlation ID and store in AsyncLocalStorage.
 * The correlation ID is used for request tracing across microservices.
 * 
 * - Extracts correlation ID from x-correlation-id header
 * - Generates new UUID if header is missing or invalid
 * - Stores in AsyncLocalStorage for access throughout request lifecycle
 * - Attaches to response header for downstream services
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction) {
		// Extract or generate correlation ID
		const incomingCorrelationId = req.header(CORRELATION_ID_HEADER)
		const correlationId = CorrelationIdHelper.extractCorrelationId(incomingCorrelationId)

		// Attach to response header for client/downstream services
		res.setHeader(CORRELATION_ID_HEADER, correlationId)

		// Run the rest of the request in the correlation context
		// Set logger context for HTTP requests (source type will be 'http')
		const context: RequestContext = {
			correlationId,
			timestamp: Date.now(),
			requestPath: req.path,
			method: req.method,
			ip: req.ip,
			loggerContext: {
				sourceType: 'http',
				// Service name will be set by individual controllers/services via setContext()
				// This ensures each controller can set its own context
			},
		};
		
		AsyncContextStorage.run(context, () => { next(); })
	}
}
